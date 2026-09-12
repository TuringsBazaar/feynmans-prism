import { chooseAction } from "./scheduler.mjs";
import { EXTRACTION_SYSTEM, REVIEW_SYSTEM, selectPassages, validateExtraction, validateReview, reviewPacket } from "./evidence.mjs";
import { hash } from "./store.mjs";
import { renderAnswer } from "./render.mjs";

const modelAction = (action) => ["extract", "verify"].includes(action.kind);

export function requestFor(store, action) {
  const config = store.config();
  const source = store.source(action.source_id);
  if (action.kind === "extract") {
    const passages = selectPassages(source, store.run().question, config.maxInputChars);
    return { system: EXTRACTION_SYSTEM, data: { question: store.run().question, task: store.run().task, title: source.title, passages }, maxOutputTokens: config.maxOutputTokens };
  }
  if (action.kind === "verify") {
    const { graph } = store.graph(source.id);
    return { system: REVIEW_SYSTEM, data: { question: store.run().question, title: source.title, ...reviewPacket(graph, source) }, maxOutputTokens: config.maxOutputTokens };
  }
  return { query: action.target, url: source?.url ?? null };
}

export function reserveTokens(action, request) {
  // Conservative input estimate: UTF-8 bytes plus message framing, output cap.
  // Actual provider usage replaces it once a complete receipt is available.
  return modelAction(action) ? Buffer.byteLength(JSON.stringify(request)) + request.maxOutputTokens + 1024 : 0;
}

function reportedTokens(response) {
  const usage = response.usage;
  if (!usage) return null;
  if (Number.isSafeInteger(usage.totalTokens) && usage.totalTokens > 0) return usage.totalTokens;
  const values = [usage.input, usage.output, usage.cacheRead, usage.cacheWrite];
  if (!values.every((n) => Number.isSafeInteger(n) && n >= 0)) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum > 0 ? sum : null;
}

function decodeModel(response) {
  if (!["stop", "toolUse"].includes(response.stopReason) || response.error) {
    throw new Error(`Model did not complete: ${response.stopReason}; ${response.error ?? "no complete answer"}`);
  }
  if (response.stopReason === "toolUse") throw new Error("Data-only operation returned a tool request");
  const text = response.text.trim();
  const fenced = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  return JSON.parse(fenced ? fenced[1] : text);
}

export function applyResponse(store, action) {
  const response = JSON.parse(action.response);
  const request = JSON.parse(action.request);
  switch (action.kind) {
    case "search":
    case "follow":
      if (!Array.isArray(response.sources)) throw new Error("Invalid search response");
      return store.finish(action, () => store.ingestSources(response, action));
    case "fetch":
      if (typeof response.text !== "string" || response.text.length < 1000) throw new Error(response.error ?? "Missing paper text");
      return store.finish(action, () => store.saveBody(action, response));
    case "extract": {
      const graph = validateExtraction(decodeModel(response), store.source(action.source_id), request.data.passages, { quarantineRelations: true });
      return store.finish(action, () => store.saveGraph(action, graph));
    }
    case "verify": {
      const review = validateReview(decodeModel(response), store.graph(action.source_id).graph);
      return store.finish(action, () => store.saveReview(action, review));
    }
    default: throw new Error(`Unknown operation: ${action.kind}`);
  }
}

export async function execute(store, backend, { recover = false, revalidate = false, budgets = {}, progress = () => {} } = {}) {
  store.acquire(recover);
  let status = "partial";
  try {
    store.extendBudgets(budgets);
    const config = store.config();
    const deadline = Date.now() + Math.max(0, config.maxElapsedMs - store.run().elapsed_ms);
    if (revalidate) {
      store.db.prepare("UPDATE actions SET status='running' WHERE status='failed' AND response IS NOT NULL AND kind IN ('extract','verify')").run();
    }
    // Responses are recorded before evidence commits. Replay a saved response
    // after a crash, without a second remote call or duplicate reinforcement.
    for (const action of store.actions().filter((a) => a.status === "running" && a.response)) {
      try { applyResponse(store, action); }
      catch (error) { store.db.prepare("UPDATE actions SET status='failed',error=? WHERE id=?").run(error.message, action.id); }
    }
    while (true) {
      const stats = store.stats();
      if (stats.actions >= config.maxActions || Date.now() >= deadline) { status = "budget_exhausted"; break; }
      const all = store.actions();
      let budgetBlocked = false;
      const selectable = all.map((a) => {
        if (a.status !== "pending" || !modelAction(a)) return a;
        // Future extraction actions do not have text yet. Budget their requests
        // only after their parent has completed.
        if (!all.some((p) => p.id === a.parent_id && p.status === "done")) return a;
        const reserve = reserveTokens(a, requestFor(store, a));
        if (stats.model_calls >= config.maxModelCalls || stats.tokens_reported + stats.tokens_reserved_unknown + reserve > config.maxTokens) {
          budgetBlocked = true;
          return { ...a, status: "budget_blocked" };
        }
        return a;
      });
      const selected = chooseAction(selectable, store.trails(), config, stats.actions);
      if (!selected) {
        const graphs = store.sources().map((s) => store.graph(s.id)).filter(Boolean);
        const direct = graphs.some((g) => g.graph.match.level === "direct" && g.review?.items.some((i) => i.id === "match" && i.verdict === "supported"));
        status = budgetBlocked ? "budget_exhausted" : direct && !stats.failed.length ? "completed" : "partial";
        break;
      }
      const { action, trace } = selected;
      const request = requestFor(store, action);
      const reserved = reserveTokens(action, request);
      store.db.prepare("UPDATE actions SET status='running',request=?,selection=?,reserved_tokens=? WHERE id=? AND status='pending'")
        .run(JSON.stringify(request), JSON.stringify(trace), reserved, action.id);
      progress({ action: action.id, kind: action.kind, source: action.source_id, status: "running" });
      const started = Date.now();
      const timeoutMs = Math.max(1, Math.min(config.timeoutMs, deadline - started));
      const controller = new AbortController();
      let timer;
      try {
        const work = modelAction(action)
          ? backend.complete(request.system, request.data, request.maxOutputTokens, controller.signal)
          : action.kind === "fetch" ? backend.fetch(store.source(action.source_id))
            : backend.search(action.target, action.kind === "search" ? Math.min(3, config.maxSources) : 2);
        const response = await Promise.race([work, new Promise((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error("Action deadline exceeded; remote outcome may be unknown")); }, timeoutMs);
        })]);
        const elapsed = Date.now() - started;
        store.atomic(() => {
          store.db.prepare("UPDATE actions SET response=?,used_tokens=?,usage=?,duration_ms=? WHERE id=?")
            .run(JSON.stringify(response), modelAction(action) ? reportedTokens(response) : 0,
              response.usage ? JSON.stringify(response.usage) : null, elapsed, action.id);
          store.db.prepare("UPDATE runs SET elapsed_ms=elapsed_ms+? WHERE id=1").run(elapsed);
        });
        applyResponse(store, store.actions().find((a) => a.id === action.id));
        progress({ action: action.id, kind: action.kind, status: "done" });
      } catch (error) {
        const current = store.actions().find((a) => a.id === action.id);
        store.atomic(() => {
          store.db.prepare("UPDATE actions SET status=?,error=? WHERE id=?")
            .run(current.response ? "failed" : "uncertain", error.message, action.id);
          if (!current.response) {
            const elapsed = Date.now() - started;
            store.db.prepare("UPDATE actions SET duration_ms=? WHERE id=?").run(elapsed, action.id);
            store.db.prepare("UPDATE runs SET elapsed_ms=elapsed_ms+? WHERE id=1").run(elapsed);
          }
        });
        progress({ action: action.id, kind: action.kind, status: "failed", error: error.message });
        // Alpha has a shared transport without per-call cancellation. End this
        // invocation after unknown outcomes instead of overlapping a second call.
        if (!current.response) { status = "partial"; break; }
      } finally { clearTimeout(timer); }
    }
  } finally {
    store.release(status);
    store.db.prepare("UPDATE runs SET answer=? WHERE id=1").run(renderAnswer(store));
    await backend.close?.();
  }
  return store.stats();
}

export function exportCorpus(store) {
  const sources = store.sources().filter((s) => s.body).map((s) => ({
    key: s.paper_key, title: s.title, url: s.url, abstract: s.abstract,
    metadata: JSON.parse(s.metadata), text: s.body, content_hash: s.content_hash, fetchedAt: s.fetched_at,
  }));
  return { version: 1, question: store.run().question, sources, hash: hash(JSON.stringify(sources)) };
}

export function corpusBackend(corpus, modelBackend) {
  if (corpus.version !== 1 || !corpus.sources.length || hash(JSON.stringify(corpus.sources)) !== corpus.hash) throw new Error("Invalid frozen corpus");
  for (const s of corpus.sources) if (hash(s.text) !== s.content_hash) throw new Error("Frozen source hash mismatch");
  return {
    ...modelBackend,
    search: async () => ({ sources: corpus.sources, provider: "frozen-corpus", corpus_hash: corpus.hash }),
    fetch: async (source) => {
      const paper = corpus.sources.find((s) => s.key === source.paper_key);
      if (!paper) throw new Error("Paper absent from frozen corpus");
      return { text: paper.text, fetchedAt: paper.fetchedAt, provider: "frozen-corpus" };
    },
  };
}
