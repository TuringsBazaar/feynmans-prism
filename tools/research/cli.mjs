import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Store, DEFAULTS } from "./store.mjs";
import { createBackend, doctor } from "./runtime.mjs";
import { execute, exportCorpus, corpusBackend } from "./engine.mjs";
import { renderAnswer, renderTree } from "./render.mjs";
import { buildView } from "./view.mjs";

const HELP = `SQLite research tree: direct Feynman model/retrieval calls, no agent session.

node tools/research/cli.mjs doctor --runtime-root /path/to/feynman/app
node tools/research/cli.mjs run --db tools/outputs/credit-assignment.sqlite \\
  --runtime-root /path/to/feynman/app --provider openrouter --model anthropic/claude-haiku-4.5 \\
  --question-file graphs/corpus/open-problems-sept-11 --question-line 1 \\
  --task-file graphs/corpus/feynman-prompt.md
node tools/research/cli.mjs resume --db tools/outputs/credit-assignment.sqlite
node tools/research/cli.mjs status --db tools/outputs/credit-assignment.sqlite
node tools/research/cli.mjs tree --db tools/outputs/credit-assignment.sqlite [--json]
node tools/research/cli.mjs append --db tools/outputs/credit-assignment.sqlite \\
  --parent 2 --label "Circuit-level analysis" --statement "Your analysis" [--refs 3,5]
node tools/research/cli.mjs answer --db tools/outputs/credit-assignment.sqlite
node tools/research/cli.mjs export-corpus --db tools/outputs/credit-assignment.sqlite --out corpus.json
node tools/research/cli.mjs view --db tools/outputs/credit-assignment.sqlite [--out out.html] [--open]

Run options: --policy aco|greedy --seed 11 --max-sources 4 --max-actions 18
  --max-model-calls 8 --max-tokens 80000 --max-output-tokens 3500
  --max-input-chars 18000 --timeout-ms 120000 --max-elapsed-ms 900000
  --retrieval public|alpha (default public) --corpus corpus.json (fixed pool; new DB)
  --auth-path /path/to/auth.json
Resume --recover abandons interrupted calls without responses; it never retries them.
Resume --revalidate rechecks saved failed model responses after a parser repair.
Resume may explicitly increase --max-tokens, --max-model-calls, --max-actions,
or --max-elapsed-ms; changes are recorded in the run configuration history.
Known responses are replayed locally. Unknown usage retains its token reservation.
Tree offsets are UTF-16 code units into the hashed SQLite source body.
`;

export async function main(args = process.argv.slice(2)) {
  const strings = ["db", "runtime-root", "auth-path", "provider", "model", "question-file", "question-line", "task-file", "policy", "seed", "max-sources", "max-actions", "max-model-calls", "max-tokens", "max-output-tokens", "max-input-chars", "timeout-ms", "max-elapsed-ms", "parent", "label", "statement", "kind", "refs", "out", "corpus", "retrieval"];
  const { values: v, positionals } = parseArgs({ args, allowPositionals: true, options: {
    ...Object.fromEntries(strings.map((s) => [s, { type: "string" }])),
    json: { type: "boolean" }, help: { type: "boolean" }, recover: { type: "boolean" }, revalidate: { type: "boolean" }, open: { type: "boolean" },
  } });
  if (v.help || !positionals.length) { console.log(HELP); return; }
  const [command] = positionals;
  if (positionals.length !== 1) throw new Error("Expected exactly one command");
  const requireValue = (name) => { if (!v[name]) throw new Error(`Missing --${name}`); return v[name]; };
  const runtimeRoot = v["runtime-root"] ?? process.env.FEYNMAN_RUNTIME_ROOT;
  if (command === "doctor") { console.log(JSON.stringify(await doctor(runtimeRoot, v["auth-path"]), null, 2)); return; }
  const dbPath = resolve(requireValue("db"));
  if (command === "run") {
    const questionLine = Number(v["question-line"] ?? 1);
    if (!Number.isSafeInteger(questionLine) || questionLine < 1) throw new Error("Invalid --question-line");
    const question = readFileSync(requireValue("question-file"), "utf8").split(/\r?\n/)[questionLine - 1]?.trim();
    if (!question || question.length > 10000) throw new Error("Question line is missing or too long");
    const task = readFileSync(requireValue("task-file"), "utf8").trim();
    if (!task || task.length > 10000) throw new Error("Task is missing or too long");
    const config = { ...DEFAULTS, runtimeRoot: resolve(runtimeRoot ?? requireValue("runtime-root")),
      provider: requireValue("provider"), model: requireValue("model"), retrieval: v.retrieval ?? "public" };
    if (v["auth-path"]) config.authPath = resolve(v["auth-path"]);
    if (v.policy) config.policy = v.policy;
    for (const key of Object.keys(DEFAULTS)) {
      const flag = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      if (v[flag] && key !== "policy") config[key] = Number(v[flag]);
    }
    let corpus;
    if (v.corpus) {
      config.corpusPath = resolve(v.corpus);
      corpus = JSON.parse(readFileSync(config.corpusPath, "utf8"));
      if (corpus.question !== question) throw new Error("Frozen corpus belongs to a different question");
      config.corpusHash = corpus.hash;
    }
    // Check configured access before creating a run. No model request yet.
    let backend = await createBackend(config);
    if (corpus) backend = corpusBackend(corpus, backend);
    mkdirSync(dirname(dbPath), { recursive: true });
    const store = new Store(dbPath, { create: { question, task, config } });
    try { console.log(JSON.stringify(await execute(store, backend, { progress: logProgress }), null, 2)); }
    finally { store.close(); }
    return;
  }
  const writable = ["resume", "append"].includes(command);
  const store = new Store(dbPath, { readOnly: !writable });
  try {
    switch (command) {
      case "resume": {
        const config = store.config();
        let backend = await createBackend(config);
        if (config.corpusPath) {
          const corpus = JSON.parse(readFileSync(v.corpus ? resolve(v.corpus) : config.corpusPath, "utf8"));
          if (corpus.hash !== config.corpusHash || corpus.question !== store.run().question) throw new Error("Frozen corpus changed since run creation");
          backend = corpusBackend(corpus, backend);
        }
        const budgets = {};
        for (const key of ["maxTokens", "maxModelCalls", "maxActions", "maxElapsedMs"]) {
          const flag = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
          if (v[flag]) budgets[key] = Number(v[flag]);
        }
        console.log(JSON.stringify(await execute(store, backend, { recover: v.recover, revalidate: v.revalidate, budgets, progress: logProgress }), null, 2));
        break;
      }
      case "tree": console.log(v.json ? JSON.stringify(store.tree(), null, 2) : renderTree(store.tree())); break;
      case "answer": console.log(renderAnswer(store)); break;
      case "status": console.log(JSON.stringify(store.stats(), null, 2)); break;
      case "append": {
        const parent = Number(requireValue("parent"));
        const refs = v.refs ? v.refs.split(",").map(Number) : [];
        console.log(JSON.stringify({ node_id: store.append(parent, requireValue("label"), requireValue("statement"), v.kind ?? "analysis", refs) }));
        break;
      }
      case "export-corpus": {
        const corpus = exportCorpus(store);
        if (!corpus.sources.length) throw new Error("No fetched sources to export");
        writeFileSync(requireValue("out"), JSON.stringify(corpus, null, 2), { flag: "wx" });
        console.log(JSON.stringify({ sources: corpus.sources.length, hash: corpus.hash }));
        break;
      }
      case "view": {
        const outPath = resolve(v.out ?? dbPath.replace(/\.sqlite$/, "") + ".view.html");
        writeFileSync(outPath, buildView(store));
        if (v.open) execFileSync("open", [outPath]);
        console.log(JSON.stringify({ path: outPath }));
        break;
      }
      default: throw new Error(`Unknown command: ${command}`);
    }
  } finally { store.close(); }
}

function logProgress(event) { process.stderr.write(`${JSON.stringify(event)}\n`); }

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
