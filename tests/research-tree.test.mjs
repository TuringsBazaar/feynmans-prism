import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Script } from "node:vm";
import { Store, DEFAULTS, hash } from "../tools/research/store.mjs";
import { execute, applyResponse, exportCorpus, corpusBackend } from "../tools/research/engine.mjs";
import { chooseAction } from "../tools/research/scheduler.mjs";
import { validateExtraction, validateReview, reviewItems, selectPassages } from "../tools/research/evidence.mjs";
import { renderAnswer } from "../tools/research/render.mjs";
import { buildView } from "../tools/research/view.mjs";
import { paperKey, contentText } from "../tools/research/runtime.mjs";
import { articleText, publicRetrieval } from "../tools/research/public-retrieval.mjs";

const quote = "Under independent measurement noise, averaging repeated observations reduces the variance of the sample mean.";
const limitQuote = "Whether these assumptions hold under correlated measurement noise remains an open question.";
const body = `${quote}\n${limitQuote}\n${"The methods section describes repeated measurement and variance estimation. ".repeat(25)}`;
const sources = [1, 2].map((id) => ({ key: `2609.0000${id}`, title: `Independent measurement noise ${id}`, url: `https://arxiv.org/abs/2609.0000${id}`, abstract: quote, metadata: { version: 1 } }));
const graph = {
  match: { level: "direct", reason: "Addresses the question's noise assumption.", quote },
  nodes: [
    { id: "a1", kind: "assumption", statement: "Measurement noise is independent.", origin: "author_stated", quote },
    { id: "a2", kind: "conclusion", statement: "Averaging reduces variance under that assumption.", origin: "author_stated", quote },
    { id: "a3", kind: "limitation", statement: "Correlated noise has not been addressed.", origin: "author_stated", quote: limitQuote },
  ],
  inferences: [{ id: "i1", premises: ["a1"], conclusion: "a2", kind: "derivation", quote }],
  open_questions: [{ id: "q1", statement: "Does the method extend to correlated noise?", origin: "author_stated", limitation_node: "a3", quote: limitQuote }],
  related_papers: [],
};

function setup(t, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "research-tree-test-"));
  const db = join(dir, "run.sqlite");
  const store = new Store(db, { create: { question: "How does independent measurement noise affect averaging?", task: "Identify papers, arguments, and remaining questions.", config: { ...DEFAULTS, maxSources: 2, ...overrides } } });
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
  return { store, db };
}

function backend() {
  const calls = [];
  return {
    calls,
    search: async (query) => { calls.push(["search", query]); return { sources }; },
    fetch: async (source) => { calls.push(["fetch", source.id]); return { text: body, fetchedAt: "2026-09-11T00:00:00Z" }; },
    complete: async (_system, data) => {
      calls.push([data.items ? "verify" : "extract", data]);
      const result = data.items ? { items: data.items.map((i) => ({ id: i.id, verdict: "supported", reason: "The quoted evidence supports the scoped statement." })) } : graph;
      return { text: JSON.stringify(result), usage: { input: 200, output: 150, cacheRead: 30, cacheWrite: 0, totalTokens: 380 }, stopReason: "stop", error: null };
    },
  };
}

test("one question builds an appendable tree, grounded dependencies, and metered answer", async (t) => {
  const { store } = setup(t);
  const api = backend();
  const stats = await execute(store, api);
  assert.equal(stats.status, "completed");
  assert.equal(stats.model_calls, 4);
  assert.equal(stats.tokens_reported, 1520);
  assert.equal(stats.tokens_reserved_unknown, 0);
  const tree = store.tree();
  assert.equal(tree.children.length, 2);
  const conclusion = tree.children[0].children[0].children.find((n) => n.kind === "conclusion");
  assert.equal(conclusion.children[0].kind, "inference");
  assert.ok(conclusion.children[0].data.premise_node_ids.length);
  const originalIds = store.db.prepare("SELECT id FROM tree_nodes ORDER BY id").all();
  const id = store.append(conclusion.id, "Population-level analysis", "Consider correlated populations.", "analysis", [tree.children[1].id]);
  assert.ok(id > conclusion.id);
  assert.deepEqual(store.db.prepare("SELECT id FROM tree_nodes WHERE id<? ORDER BY id").all(id), originalIds);
  assert.match(renderAnswer(store), /Population-level analysis/);
  const callsBefore = api.calls.length;
  await execute(store, api);
  assert.equal(api.calls.length, callsBefore, "finished runs do not call the model again");
  assert.ok(store.tree().children[0].children[0].children.find((n) => n.id === conclusion.id).children.some((n) => n.id === id));
});

test("exact evidence anchors and dependency endpoints are enforced", () => {
  const source = { id: 1, body, content_hash: hash(body) };
  const passages = selectPassages(source, "noise");
  const result = validateExtraction(graph, source, passages);
  assert.equal(source.body.slice(result.nodes[0].evidence.start, result.nodes[0].evidence.end), quote);
  const invented = structuredClone(graph);
  invented.nodes[0].quote = "This entirely invented quotation should not appear in the source.";
  assert.throws(() => validateExtraction(invented, source, passages), /absent/);
  const badEdge = structuredClone(graph); badEdge.inferences[0].premises = ["missing"];
  assert.throws(() => validateExtraction(badEdge, source, passages), /endpoints/);
  const cycle = structuredClone(graph);
  cycle.inferences.push({ id: "i2", premises: ["a2"], conclusion: "a1", kind: "derivation", quote });
  assert.throws(() => validateExtraction(cycle, source, passages), /Cyclic/);
});

test("review must be complete and unsupported premises constrain dependencies", () => {
  const value = { items: reviewItems(graph).map((i) => ({ id: i.id, verdict: "supported", reason: "Supported." })) };
  value.items.find((i) => i.id === "a1").verdict = "unsupported";
  value.items.find((i) => i.id === "a3").verdict = "uncertain";
  const result = validateReview(value, graph);
  assert.equal(result.items.find((i) => i.id === "i1").verdict, "uncertain");
  assert.equal(result.items.find((i) => i.id === "q1").verdict, "uncertain");
  value.items.pop();
  assert.throws(() => validateReview(value, graph), /Incomplete/);
});

test("passage references attach immutable source text without model-written quotes", () => {
  const source = { id: 1, body, content_hash: hash(body) };
  const passages = selectPassages(source, "noise");
  const referenced = structuredClone(graph);
  for (const item of [referenced.match, ...referenced.nodes, ...referenced.inferences, ...referenced.open_questions]) {
    delete item.quote; item.passage_id = passages[0].id;
  }
  const result = validateExtraction(referenced, source, passages);
  const evidence = result.nodes[0].evidence;
  assert.equal(evidence.quote, undefined);
  assert.equal(source.body.slice(evidence.start, evidence.end), passages[0].text);
  referenced.nodes[0].passage_id = "p999999";
  assert.throws(() => validateExtraction(referenced, source, passages), /Unknown evidence passage/);
});

test("ACO selections are reproducible, honor prerequisites, and react to pheromone", () => {
  const actions = [
    { id: 1, kind: "search", parent_id: null, status: "done", eta: 1 },
    { id: 2, kind: "fetch", parent_id: 1, status: "pending", eta: 0.5 },
    { id: 3, kind: "follow", parent_id: 1, status: "pending", eta: 0.5 },
    { id: 4, kind: "extract", parent_id: 2, status: "pending", eta: 0.8 },
  ];
  const a = chooseAction(actions, {}, DEFAULTS, 1);
  assert.deepEqual(chooseAction(actions, {}, DEFAULTS, 1), a);
  assert.ok([2, 3].includes(a.action.id));
  let baseline = 0; let reinforced = 0;
  for (let seed = 0; seed < 60; seed++) {
    baseline += Number(chooseAction(actions, {}, { ...DEFAULTS, seed }, 1).action.id === 3);
    reinforced += Number(chooseAction(actions, { "search->follow": 10 }, { ...DEFAULTS, seed }, 1).action.id === 3);
  }
  assert.ok(reinforced > baseline + 10);
  assert.equal(chooseAction(actions.map((a) => ({ ...a, status: "done" })), {}, DEFAULTS, 1), null);
});

test("quarantining a malformed relation preserves independent evidence without approving it", () => {
  const source = { id: 1, body, content_hash: hash(body) };
  const invalid = structuredClone(graph);
  invalid.inferences[0].premises = ["a2"];
  const result = validateExtraction(invalid, source, selectPassages(source, "noise"), { quarantineRelations: true });
  assert.equal(result.inferences.length, 0);
  assert.equal(result.nodes.length, 3);
  assert.equal(result.validation_issues.length, 1);
  assert.ok(!reviewItems(result).some((i) => i.id === "i1"));
});

test("committed review replay cannot deposit pheromone or duplicate evidence twice", async (t) => {
  const { store } = setup(t);
  await execute(store, backend());
  const action = store.actions().find((a) => a.kind === "verify");
  const trails = store.trails();
  const before = store.tree();
  assert.equal(applyResponse(store, action), false);
  assert.deepEqual(store.trails(), trails);
  assert.deepEqual(store.tree(), before);
});

test("durable remote response resumes without refetching", async (t) => {
  const { store } = setup(t);
  store.db.prepare("UPDATE actions SET status='running',request='{}',response=? WHERE id=1").run(JSON.stringify({ sources }));
  const api = backend();
  await execute(store, api);
  assert.equal(api.calls.filter(([kind]) => kind === "search").length, 0);
});

test("unknown interrupted outcome requires recovery and retains reserved budget", async (t) => {
  const { store } = setup(t);
  store.db.prepare("UPDATE actions SET status='running',request='{}',reserved_tokens=4000 WHERE id=1").run();
  await assert.rejects(execute(store, backend()), /unknown outcomes/);
  const api = backend();
  await execute(store, api, { recover: true });
  assert.equal(api.calls.length, 0);
  assert.equal(store.actions()[0].status, "uncertain");
  assert.equal(store.stats().tokens_reserved_unknown, 4000);
});

test("single writer ownership prevents concurrent execution or append", (t) => {
  const { store, db } = setup(t);
  store.acquire();
  const second = new Store(db);
  try { assert.throws(() => second.acquire(), /Another executor/); }
  finally { second.close(); }
  assert.throws(() => store.append(1, "Analysis", "Wait for pause."), /Pause/);
  store.release("paused");
  assert.throws(() => store.append(999, "Analysis", "Unknown parent."), /Parent/);
  assert.throws(() => store.append(1, "Analysis", "Invalid cross-reference.", "analysis", [999]), /Reference/);
});

test("failed/truncated model calls are metered and do not become evidence", async (t) => {
  const { store } = setup(t);
  const api = backend();
  api.complete = async () => ({ text: "{", usage: { totalTokens: 500 }, stopReason: "length", error: null });
  await execute(store, api);
  assert.equal(store.stats().tokens_reported, 1000);
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM central_arguments").get().n, 0);
  assert.equal(Object.keys(store.trails()).length, 0);
});

test("a single JSON fence is parsed but free-form commentary is rejected", async (t) => {
  const { store } = setup(t);
  const api = backend();
  const complete = api.complete;
  api.complete = async (...args) => {
    const response = await complete(...args);
    return { ...response, text: `\`\`\`json\n${response.text}\n\`\`\`` };
  };
  await execute(store, api);
  assert.equal(store.stats().reviewed_sources, 2);
  const action = store.actions().find((a) => a.kind === "extract");
  const response = JSON.parse(action.response);
  response.text = `Explanatory preamble\n${response.text}`;
  assert.throws(() => applyResponse(store, { ...action, response: JSON.stringify(response) }), /Unexpected token/);
});

test("token reservation prevents model calls that cannot fit", async (t) => {
  const { store } = setup(t, { maxTokens: 100 });
  const api = backend();
  const stats = await execute(store, api);
  assert.equal(stats.model_calls, 0);
  assert.equal(stats.status, "budget_exhausted");
  assert.equal(api.calls.filter(([kind]) => kind === "extract").length, 0);
});

test("explicit budget increases resume pending work and record the change", async (t) => {
  const { store } = setup(t, { maxTokens: 100 });
  await execute(store, backend());
  const stats = await execute(store, backend(), { budgets: { maxTokens: DEFAULTS.maxTokens } });
  assert.equal(stats.reviewed_sources, 2);
  assert.deepEqual(store.config().budgetHistory[0].changes.maxTokens, { from: 100, to: DEFAULTS.maxTokens });
  await assert.rejects(execute(store, backend(), { budgets: { maxTokens: 10 } }), /increase/);
  assert.equal(store.run().owner_pid, null);
});

test("frozen corpus keeps content hashes and contains no model answers", async (t) => {
  const { store } = setup(t);
  await execute(store, backend());
  const corpus = exportCorpus(store);
  assert.equal(corpus.sources.length, 2);
  assert.equal(corpus.sources[0].graph, undefined);
  const frozen = corpusBackend(corpus, {});
  assert.equal((await frozen.fetch(store.sources()[0])).text, body);
  corpus.sources[0].text += "modified";
  assert.throws(() => corpusBackend(corpus, {}), /Invalid frozen/);
});

test("arXiv canonical identities, content shapes, and question-only inputs", () => {
  assert.equal(paperKey("https://arxiv.org/abs/2403.18929v1"), "2403.18929");
  assert.equal(paperKey("2403.18929"), "2403.18929");
  assert.throws(() => paperKey("https://www.emergentmind.com/open-problems/answer"), /Unsupported/);
  assert.equal(contentText({ content: [{ type: "text", text: body }] }), body);
  assert.throws(() => contentText({ message: "No full text" }), /recognizable/);
  const prompt = readFileSync(new URL("../graphs/corpus/feynman-prompt.md", import.meta.url), "utf8");
  assert.doesNotMatch(prompt, /2403\.18929|emergentmind\.com/);
});

test("public retrieval keeps only article content and preserves math as LaTeX", async () => {
  const html = `<nav>Outside article</nav><article><h2>Methods</h2><script>bad()</script><p>${quote}</p><math alttext="x &lt; y"><mi>x</mi></math><p>${body}</p></article>`;
  const text = articleText(html);
  assert.match(text, /\$x < y\$/);
  assert.doesNotMatch(text, /bad\(\)|Outside article/);
  const urls = [];
  const retrieval = publicRetrieval(async (url) => {
    urls.push(String(url));
    return new Response(urls.length === 1 ? JSON.stringify([
      { paperId: "2609.00001", title: "Noise paper", snippet: quote },
      { paperId: "2609.00001v2", title: "Duplicate version" },
    ]) : html, { status: 200 });
  });
  const result = await retrieval.search("measurement noise", 3);
  assert.equal(result.sources.length, 1);
  const fetched = await retrieval.fetch({ paper_key: "2609.00001" });
  assert.equal(fetched.text, text);
  assert.ok(urls.every((url) => !url.includes("emergentmind")));
});

test("view renders a self-contained, zoomable tree without alternate views", async (t) => {
  const { store } = setup(t);
  await execute(store, backend());
  const html = buildView(store);
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("<svg id=\"tree-svg\">"));
  assert.ok(html.includes('id="zoom-in"'));
  assert.ok(html.includes('id="zoom-out"'));
  assert.ok(html.includes('id="zoom-reset"'));
  assert.ok(html.includes("Scroll wheel: zoom"));
  assert.ok(html.includes("Hold mouse wheel + drag: pan"));
  assert.ok(!html.includes('id="tab-graph"'));
  assert.ok(!html.includes('id="graph-svg"'));
  assert.ok(!html.includes("cdn.jsdelivr.net"));
  assert.ok(!html.includes("__RESEARCH_DATA__"));
  const match = html.match(/var DATA = (.*?);\n/);
  assert.ok(match);
  const data = JSON.parse(match[1]);
  assert.equal(data.tree.children.length, 2);
  assert.equal(data.sources[0].body, body, "standalone view includes the source snapshot for evidence excerpts");
  new Script(html.match(/<script>\n([\s\S]*?)\n<\/script>/)[1]);
});

test("view preserves evidence anchors and safely embeds source and node text", async (t) => {
  const { store } = setup(t);
  await execute(store, backend());
  const hostile = '</script><img src=x onerror="alert(1)">';
  store.append(store.tree().id, hostile, hostile);
  const html = buildView(store);
  assert.ok(!html.includes(hostile), "node content cannot escape the data script");
  const data = JSON.parse(html.match(/var DATA = (.*?);\n/)[1]);
  const assumption = data.tree.children[0].children[0].children.find((n) => n.kind === "assumption");
  const ev = assumption.data.evidence;
  const source = data.sources.find((s) => s.id === ev.source_id);
  assert.equal(source.content_hash, ev.content_hash);
  assert.equal(source.body.slice(ev.start, ev.end), quote);
  assert.equal(data.tree.children.at(-1).label, hostile);
});
