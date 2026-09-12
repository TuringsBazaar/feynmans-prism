import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync } from "node:fs";
import { hostname } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { relevance, transition } from "./scheduler.mjs";

const VERSION = 1;
export const hash = (text) => createHash("sha256").update(text).digest("hex");
const json = (value) => JSON.stringify(value);
const now = () => new Date().toISOString();

export const DEFAULTS = {
  policy: "aco", seed: 11, alpha: 1, beta: 2, rho: 0.1, epsilon: 0.15,
  ants: 16, hops: 3, maxSources: 4, maxActions: 18, maxModelCalls: 8,
  maxTokens: 80000, maxOutputTokens: 3500, maxInputChars: 18000,
  timeoutMs: 120000, maxElapsedMs: 900000,
};

export function validateConfig(config) {
  if (!["aco", "greedy"].includes(config.policy)) throw new Error("Policy must be aco or greedy");
  if (config.retrieval && !["public", "alpha"].includes(config.retrieval)) throw new Error("Retrieval must be public or alpha");
  for (const [key, max] of Object.entries({ seed: 2 ** 32 - 1, ants: 256, hops: 10,
    maxSources: 30, maxActions: 200, maxModelCalls: 100, maxTokens: 1_000_000,
    maxOutputTokens: 16000, maxInputChars: 100000, timeoutMs: 600000, maxElapsedMs: 3600000 })) {
    if (!Number.isSafeInteger(config[key]) || config[key] < (key === "seed" ? 0 : 1) || config[key] > max) throw new Error(`Invalid ${key}`);
  }
  if (config.maxInputChars < 3000) throw new Error("maxInputChars must be at least 3000");
  for (const key of ["alpha", "beta", "rho", "epsilon"]) {
    if (!Number.isFinite(config[key]) || config[key] < 0 || config[key] > (key === "alpha" || key === "beta" ? 5 : 1)) throw new Error(`Invalid ${key}`);
  }
}

export class Store {
  constructor(path, { create, readOnly = false } = {}) {
    if (!create && !existsSync(path)) throw new Error(`Database does not exist: ${path}`);
    if (create && existsSync(path)) throw new Error(`Database already exists; use resume: ${path}`);
    if (create) validateConfig(create.config);
    this.db = new DatabaseSync(path, { readOnly });
    if (create) {
      this.db.exec(readFileSync(new URL("schema.sql", import.meta.url), "utf8"));
      this.atomic(() => {
        this.db.prepare("INSERT INTO runs(id,version,question,task,config,created_at) VALUES(1,?,?,?,?,?)")
          .run(VERSION, create.question, create.task, json(create.config), now());
        this.node(null, "root", "question", create.question, null, {});
        this.enqueue("search", create.question, null, null, 1);
      });
    } else {
      this.db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
      if (this.run().version !== VERSION) throw new Error("Unsupported research database version");
      validateConfig(this.config());
    }
  }
  atomic(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = fn(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  close() { this.db.close(); }
  run() { return this.db.prepare("SELECT * FROM runs WHERE id=1").get(); }
  config() { return JSON.parse(this.run().config); }
  actions() { return this.db.prepare("SELECT * FROM actions ORDER BY id").all(); }
  sources() { return this.db.prepare("SELECT * FROM sources ORDER BY id").all(); }
  source(id) { return this.db.prepare("SELECT * FROM sources WHERE id=?").get(id); }
  graph(id) {
    const row = this.db.prepare("SELECT * FROM central_arguments WHERE source_id=?").get(id);
    return row ? { ...row, graph: JSON.parse(row.graph), review: row.review && JSON.parse(row.review) } : null;
  }
  trails() { return Object.fromEntries(this.db.prepare("SELECT * FROM trails ORDER BY transition").all().map((t) => [t.transition, t.pheromone])); }
  enqueue(kind, target, sourceId, parentId, eta) {
    this.db.prepare("INSERT OR IGNORE INTO actions(kind,target,source_id,parent_id,eta) VALUES(?,?,?,?,?)")
      .run(kind, target, sourceId, parentId, Math.max(0.05, Math.min(1, eta)));
    return this.db.prepare("SELECT id FROM actions WHERE kind=? AND target=?").get(kind, target).id;
  }
  acquire(recover = false) {
    this.atomic(() => {
      const run = this.run();
      if (run.owner_pid !== null) {
        let alive = run.owner_host !== hostname();
        if (!alive) {
          try { process.kill(run.owner_pid, 0); alive = true; }
          catch (error) { alive = error.code !== "ESRCH"; }
        }
        if (alive) throw new Error("Another executor owns this database");
      }
      const uncertain = this.db.prepare("SELECT id FROM actions WHERE status='running' AND response IS NULL").all();
      if (uncertain.length && !recover) throw new Error("Interrupted calls have unknown outcomes; inspect then resume --recover (no automatic retry)");
      if (recover) this.db.prepare("UPDATE actions SET status='uncertain',error='Interrupted remote outcome; reserved tokens retained' WHERE status='running' AND response IS NULL").run();
      this.db.prepare("UPDATE runs SET owner_pid=?,owner_host=?,status='running' WHERE id=1").run(process.pid, hostname());
    });
  }
  release(status) {
    this.db.prepare("UPDATE runs SET owner_pid=NULL,owner_host=NULL,status=? WHERE id=1 AND owner_pid=? AND owner_host=?")
      .run(status, process.pid, hostname());
  }
  extendBudgets(updates) {
    if (!Object.keys(updates).length) return;
    this.atomic(() => {
      const run = this.run();
      if (run.owner_pid !== process.pid || run.owner_host !== hostname()) throw new Error("Executor ownership required to extend budgets");
      const config = this.config(); const changes = {};
      for (const [key, value] of Object.entries(updates)) {
        if (!["maxTokens", "maxModelCalls", "maxActions", "maxElapsedMs"].includes(key) || value < config[key]) throw new Error("Resume can only increase total run budgets");
        if (value !== config[key]) changes[key] = { from: config[key], to: value };
        config[key] = value;
      }
      validateConfig(config);
      if (Object.keys(changes).length) config.budgetHistory = [...(config.budgetHistory ?? []), { at: now(), changes }];
      this.db.prepare("UPDATE runs SET config=? WHERE id=1").run(json(config));
    });
  }
  node(parent, key, kind, label, sourceId, data, origin = "executor") {
    this.db.prepare("INSERT OR IGNORE INTO tree_nodes(parent_id,node_key,kind,label,source_id,data,origin,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(parent, key, kind, label, sourceId, json(data), origin, now());
    return this.db.prepare("SELECT id FROM tree_nodes WHERE node_key=?").get(key).id;
  }
  nodeData(key, change) {
    const row = this.db.prepare("SELECT id,data FROM tree_nodes WHERE node_key=?").get(key);
    if (!row) throw new Error(`Tree node missing: ${key}`);
    this.db.prepare("UPDATE tree_nodes SET data=? WHERE id=?").run(json({ ...JSON.parse(row.data), ...change }), row.id);
  }
  append(parentId, label, statement, kind = "analysis", references = []) {
    if (!label.trim() || label.length > 500 || statement.length > 20000 || !/^[a-z][a-z_-]{0,40}$/.test(kind)) throw new Error("Invalid analysis node");
    return this.atomic(() => {
      if (this.run().owner_pid !== null) throw new Error("Pause the executor before appending analysis");
      if (!this.db.prepare("SELECT id FROM tree_nodes WHERE id=?").get(parentId)) throw new Error("Parent node does not exist");
      if (!Array.isArray(references) || references.some((id) => !Number.isSafeInteger(id) || !this.db.prepare("SELECT id FROM tree_nodes WHERE id=?").get(id))) throw new Error("Reference node does not exist");
      const id = this.node(parentId, `user:${randomUUID()}`, kind, label, null, { statement, reference_ids: [...new Set(references)], status: "user_added" }, "user");
      this.db.prepare("UPDATE runs SET answer=NULL WHERE id=1").run();
      return id;
    });
  }
  tree() {
    const nodes = this.db.prepare("SELECT * FROM tree_nodes ORDER BY id").all();
    const index = new Map(nodes.map((n) => [n.id, { id: n.id, kind: n.kind, label: n.label, source_id: n.source_id, origin: n.origin, data: JSON.parse(n.data), children: [] }]));
    for (const n of nodes) if (n.parent_id !== null) index.get(n.parent_id).children.push(index.get(n.id));
    return index.get(1);
  }
  ingestSources(response, action) {
    const root = this.db.prepare("SELECT id FROM tree_nodes WHERE node_key='root'").get().id;
    for (const p of response.sources) {
      if (this.sources().length >= this.config().maxSources) break;
      const score = relevance(this.run().question, p);
      this.db.prepare("INSERT OR IGNORE INTO sources(paper_key,title,url,abstract,metadata,relevance) VALUES(?,?,?,?,?,?)")
        .run(p.key, p.title, p.url, p.abstract, json(p.metadata ?? {}), score);
      const source = this.db.prepare("SELECT * FROM sources WHERE paper_key=?").get(p.key);
      this.node(root, `paper:${source.id}`, "paper", p.title, source.id, { paper_key: p.key, url: p.url, status: "candidate" });
      const fetch = this.enqueue("fetch", p.key, source.id, action.id, 0.2 + 0.8 * score);
      const extract = this.enqueue("extract", p.key, source.id, fetch, 0.6 + 0.4 * score);
      this.enqueue("verify", p.key, source.id, extract, 0.9);
    }
  }
  saveBody(action, response) {
    const digest = hash(response.text);
    const source = this.source(action.source_id);
    if (source.content_hash && source.content_hash !== digest) throw new Error("Cannot replace an immutable source snapshot");
    this.db.prepare("UPDATE sources SET body=?,content_hash=?,fetched_at=? WHERE id=?")
      .run(response.text, digest, response.fetchedAt ?? now(), source.id);
    this.nodeData(`paper:${source.id}`, { content_hash: digest, status: "fetched", snapshot_url: response.url ?? source.url });
  }
  saveGraph(action, graph) {
    const source = this.source(action.source_id);
    this.db.prepare("INSERT INTO central_arguments(source_id,action_id,content_hash,graph) VALUES(?,?,?,?)")
      .run(source.id, action.id, source.content_hash, json(graph));
    const paperNode = this.db.prepare("SELECT id FROM tree_nodes WHERE node_key=?").get(`paper:${source.id}`).id;
    this.nodeData(`paper:${source.id}`, { match: graph.match, status: "unreviewed" });
    const args = this.node(paperNode, `arguments:${source.id}`, "central_arguments", "Central arguments", source.id, {});
    const refs = {};
    for (const n of graph.nodes) refs[n.id] = this.node(args, `item:${source.id}:${n.id}`, n.kind, n.statement, source.id, { ...n, status: "unreviewed" });
    for (const i of graph.inferences) this.node(refs[i.conclusion], `item:${source.id}:${i.id}`, "inference", i.kind, source.id,
      { ...i, premise_node_ids: i.premises.map((id) => refs[id]), conclusion_node_id: refs[i.conclusion], status: "unreviewed" });
    const questions = this.node(paperNode, `questions:${source.id}`, "open_questions", "Open questions", source.id, {});
    for (const q of graph.open_questions) {
      this.db.prepare("INSERT INTO open_questions(source_id,item_id,statement,origin,limitation_node,evidence) VALUES(?,?,?,?,?,?)")
        .run(source.id, q.id, q.statement, q.origin, q.limitation_node, json(q.evidence));
      this.node(questions, `item:${source.id}:${q.id}`, "open_question", q.statement, source.id,
        { ...q, limitation_node_id: refs[q.limitation_node], status: "unreviewed" });
    }
    const related = this.node(paperNode, `related:${source.id}`, "related_papers", "Related papers", source.id, {});
    for (const p of graph.related_papers) {
      this.db.prepare("INSERT INTO related_papers(source_id,item_id,title,relationship,rationale,evidence) VALUES(?,?,?,?,?,?)")
        .run(source.id, p.id, p.title, p.relationship, p.rationale, json(p.evidence));
      this.node(related, `item:${source.id}:${p.id}`, "related_paper", p.title, source.id, { ...p, status: "unreviewed" });
    }
    if (graph.validation_issues?.length) {
      const issues = this.node(paperNode, `issues:${source.id}`, "validation_issues", "Rejected structural links", source.id, {});
      graph.validation_issues.forEach((issue, i) => this.node(issues, `rejected:${source.id}:${i}`, "rejected_item", issue.reason,
        source.id, { ...issue, status: "rejected" }));
    }
  }
  saveReview(action, review) {
    const sourceId = action.source_id;
    const { graph } = this.graph(sourceId);
    const verdicts = Object.fromEntries(review.items.map((i) => [i.id, i.verdict]));
    this.db.prepare("UPDATE central_arguments SET review=?,status='reviewed' WHERE source_id=?").run(json(review), sourceId);
    this.nodeData(`paper:${sourceId}`, { status: "reviewed", match_review: review.items.find((i) => i.id === "match") });
    for (const item of review.items.filter((i) => i.id !== "match")) {
      this.nodeData(`item:${sourceId}:${item.id}`, { status: item.verdict, review_reason: item.reason });
      this.db.prepare("UPDATE open_questions SET status=? WHERE source_id=? AND item_id=?").run(item.verdict, sourceId, item.id);
      this.db.prepare("UPDATE related_papers SET status=? WHERE source_id=? AND item_id=?").run(item.verdict, sourceId, item.id);
    }
    for (const p of graph.related_papers.filter((p) => verdicts[p.id] === "supported")) {
      if (this.sources().length < this.config().maxSources) this.enqueue("follow", p.title, sourceId, action.id, 0.65);
    }
    // Bounded coverage reward, not a truth probability. Rejected matches get no
    // reward; a well-supported irrelevant finding can still narrow the search.
    const covered = [
      verdicts.match === "supported",
      graph.nodes.some((n) => n.kind === "conclusion" && verdicts[n.id] === "supported"),
      graph.inferences.some((i) => verdicts[i.id] === "supported"),
      graph.open_questions.some((q) => verdicts[q.id] === "supported"),
    ];
    return covered.filter(Boolean).length / covered.length;
  }
  finish(action, apply, reward = 0) {
    return this.atomic(() => {
      const current = this.db.prepare("SELECT * FROM actions WHERE id=?").get(action.id);
      if (current.status === "done") return false;
      if (current.status !== "running" || !current.response) throw new Error("Action has no durable response");
      const observed = apply();
      const deposit = typeof observed === "number" ? observed : reward;
      this.db.prepare("UPDATE actions SET status='done',reward=? WHERE id=?").run(deposit, action.id);
      const config = this.config();
      if (config.policy === "aco") {
        this.db.prepare("UPDATE trails SET pheromone=max(0.05,pheromone*(1-?))").run(config.rho);
        if (deposit > 0) {
          const all = this.actions();
          const keys = new Set();
          let cursor = action;
          while (cursor) {
            keys.add(transition(cursor, all));
            cursor = all.find((a) => a.id === cursor.parent_id);
          }
          for (const key of keys) this.db.prepare(`INSERT INTO trails(transition,pheromone) VALUES(?,?)
            ON CONFLICT(transition) DO UPDATE SET pheromone=min(10,pheromone+?)`)
            .run(key, 1 + deposit / keys.size, deposit / keys.size);
        }
      }
      this.db.prepare("UPDATE runs SET answer=NULL WHERE id=1").run();
      return true;
    });
  }
  stats() {
    const actions = this.actions();
    const attempted = actions.filter((a) => a.request !== null);
    return {
      status: this.run().status,
      sources: this.sources().length,
      reviewed_sources: this.db.prepare("SELECT count(*) AS n FROM central_arguments WHERE status='reviewed'").get().n,
      rejected_links: this.db.prepare("SELECT count(*) AS n FROM tree_nodes WHERE kind='rejected_item'").get().n,
      actions: attempted.length,
      model_calls: attempted.filter((a) => ["extract", "verify"].includes(a.kind)).length,
      tokens_reported: attempted.reduce((sum, a) => sum + (a.used_tokens ?? 0), 0),
      tokens_reserved_unknown: attempted.filter((a) => a.used_tokens === null).reduce((sum, a) => sum + a.reserved_tokens, 0),
      elapsed_ms: this.run().elapsed_ms,
      failed: actions.filter((a) => ["failed", "uncertain"].includes(a.status)).map((a) => ({ id: a.id, kind: a.kind, error: a.error })),
    };
  }
}
