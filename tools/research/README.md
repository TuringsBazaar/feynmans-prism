# SQLite research tree

Run one paper-reconstruction question through a SQLite-backed executor. It calls
Feynman's installed model runtime and paper retrieval endpoints directly. It does
not create a Pi session, load research skills, generate scripts, or write
intermediate plans, notes, and drafts.

## Run the first question

Use Node.js 22.22 or newer with `node:sqlite`, an installed Feynman app directory,
and configured model credentials. No new npm dependency is
required. The runtime directory contains `package.json` and `node_modules`.

```bash
export FEYNMAN_RUNTIME_ROOT="$HOME/.local/share/feynman/feynman-0.3.45-darwin-arm64/app"
node tools/research/cli.mjs doctor
node tools/research/cli.mjs run \
  --db tools/outputs/credit-assignment.sqlite \
  --provider openrouter --model anthropic/claude-haiku-4.5 \
  --question-file graphs/corpus/open-problems-sept-11 --question-line 1 \
  --task-file graphs/corpus/feynman-prompt.md
```

Adjust the runtime path to your installation. `doctor` reports configured provider
names and a selection of model IDs, without printing credentials. Run inputs are
copied into the database, so later prompt edits do not change an existing run.

The default `--retrieval public` uses alphaXiv's public fast search and arXiv HTML
(with ar5iv HTML fallback), without an alpha login. HTML is normalized into a
stored text snapshot; MathML `alttext` retains available LaTeX. Papers without
usable HTML produce an explicit retrieval failure. `--retrieval alpha` instead
uses Feynman's alpha library and requires its configured login. There is no silent
switch between retrieval methods within a run.

Defaults allow 4 sources, 18 actions, 8 model calls, 3,500 output tokens per call,
18,000 source characters per extraction, 80,000 aggregate tokens, and 15 minutes
of active execution. Each action has a two-minute deadline. Input token
reservations conservatively use UTF-8 byte counts plus framing; reported usage
replaces reservations when available. Unknown usage retains its reservation.
These are client-side limits, not a provider billing guarantee. Alpha may retry
internally and does not expose inference billing; its usage is not counted as
known model tokens.

The initial search accepts up to three arXiv papers, leaving room for a reviewed
related-paper lead. Sources are identified by base arXiv ID; fetched text and its
SHA-256 hash are immutable within the run. Retrieval responses are retained in
action receipts. The prototype requests full text, but extraction uses bounded
windows selected by question overlap and discussion/limitation headings. The
answer is limited to that evidence, not a claim to exhaustive paper coverage.

## Inspect and append to the tree

SQLite is the authoritative store. Tree nodes have stable integer IDs and one
parent. The containment structure is:

```text
question
└─ paper
   ├─ central arguments
   │  ├─ assumption
   │  ├─ conclusion
   │  │  └─ inference → references to jointly required premise node IDs
   │  └─ limitation
   ├─ open questions → references to limitation node IDs
   └─ related papers and follow-up search topics
```

Statements and passages are text. Extraction returns passage IDs rather than
model-written quotations; the executor attaches exact text and offsets from the
stored snapshot. Statements still need semantic review against those passages.
Node identity, containment, typed dependencies,
evidence offsets, action states, and pheromone weights are structured data.
Argument graphs use validated JSON inside SQLite; containment uses foreign keys.
Offsets are **UTF-16 code units** into the exact `sources.body` snapshot, matching
JavaScript string indexing. `source_id` and `content_hash` identify that snapshot.

```bash
node tools/research/cli.mjs status --db tools/outputs/credit-assignment.sqlite
node tools/research/cli.mjs tree --db tools/outputs/credit-assignment.sqlite
node tools/research/cli.mjs tree --db tools/outputs/credit-assignment.sqlite --json
node tools/research/cli.mjs append --db tools/outputs/credit-assignment.sqlite \
  --parent 2 --label "Circuit-level analysis" \
  --statement "Examine which circuit constraints this argument assumes."
node tools/research/cli.mjs answer --db tools/outputs/credit-assignment.sqlite
```

Choose the parent ID from `tree`. You can append further analysis beneath your own
nodes and add `--refs 3,5` for cross-references to existing nodes. User additions
are retained on resume, labeled `user_added`, and excluded from automatic model
context and pheromone rewards. The final answer is rendered deterministically
from reviewed records and your appended analysis; it needs no extra model call.

## Visualize in the browser

`view` writes a single self-contained HTML page that renders the research tree
with plain JavaScript and SVG — no external libraries
or CDN. The data is inlined, so the page is fully offline and portable. Layouts
are computed once per interaction (static, on demand) — there is no force
simulation or continuous animation. It is a browser view of the same data
`tree` and `answer` print as text.

```bash
node tools/research/cli.mjs view \
  --db tools/outputs/credit-assignment-passages.sqlite \
  --out tools/outputs/credit-assignment-passages.view.html --open
```

`--out` defaults to the database path with `.sqlite` replaced by `.view.html`.
`--open` launches it in the default browser on macOS. The viewer uses a purple
theme, small circular nodes, and full-length wrapped text beside each node.
Click a circle or its label (or focus it and press Enter/Space) to select it. The right-hand panel shows
the full statement, review reasoning, exact quoted source passage, source link,
and linked premises, conclusions, limitations, questions, and overlapping evidence.
Selecting a paper shows its relevance judgment and the passage supporting it.
Click a connection in the panel to inspect that node; its ancestors expand in
the tree. Separate **+ / −** controls collapse branches without changing selection.

The viewer has one **Tree** surface. It starts with a compact question-and-papers
overview; **Expand all** reveals every branch. Use the **−**, percentage, and **+**
controls to zoom out, reset to 100%, and zoom in. The mouse wheel or trackpad
zooms around the pointer. Hold the mouse wheel and drag to pan the tree. These
controls are also explained in an overlay on the tree. The detail panel scrolls
independently on the right, and moves below the diagram on narrow screens. The
offline export includes source snapshots to resolve evidence offsets without a server.

For the credit-assignment run, `tools/outputs/human-commentary.md` records zero
paper-ID overlap with three Emergent Mind references. The database also stores
per-paper model relevance judgments (two `direct`, one `related`) and their
reviews. These assess relevance to the question; there is no saved comparative
relevance assessment against the Emergent Mind papers. Zero overlap alone does
not establish that the selected papers are irrelevant.

### Deploy the viewer to Cloudflare

Build a dedicated static directory and deploy it with an authenticated Wrangler:

```bash
node tools/research/build-site.mjs
wrangler deploy --config tools/research/cloudflare/wrangler.jsonc
```

Only `tools/outputs/prism-site/` is published. Its standalone `index.html` contains
the tree, reviews, and source snapshots for evidence display; the SQLite databases
are not deployed. Rebuild and redeploy to publish later research or viewer changes.

## ACO and evidence review

The action vocabulary is `search`, `fetch`, `extract`, `verify`, and `follow`.
Extraction produces central arguments, assumption dependencies, open questions,
and browsing leads in a single structured response. A separate, bounded model
call reviews every item against its source passage. Passage-reference and graph validation are
deterministic; semantic support remains a fallible model judgment, even after
review. Inferred statements and author-stated claims retain separate labels.
Malformed inference endpoints and open-question limitation links are quarantined
as rejected tree nodes, excluded from review and reward. Valid independent claims
can still proceed. Schema failures, invalid source references on claim nodes, and
cyclic argument dependencies reject the extraction. Quarantine never repairs or
invents a missing scientific relationship.

ACO simulates short paths through the pending action dependency tree. Ants are
local computations, not separate model agents. Their starting probabilities use
pheromone, a fixed heuristic, and an exploration mixture. Path-average heuristic
scores weight their votes; one frontier action is executed. Simulated paths earn
no reward. A completed review earns bounded coverage credit for source matching,
supported conclusions, supported argument links, and grounded open questions.
Credit is deposited along the executed ancestry, using action-type transition
keys shared only within this run. It is a coverage heuristic, not a measured
information gain or truth probability. Dead ends stop simulated paths; new
selections start at the complete eligible frontier.

The first prototype uses token-overlap relevance and fixed action priorities.
The previously discussed entropy/honesty/compression proxies and PaperRank are
not part of this executor. `--policy greedy` selects the highest-heuristic eligible
action under the same execution and evidence rules.

## Recovery and comparison

One process owns a writable run at a time. Remote calls happen outside SQLite
transactions. The response and usage receipt are saved before evidence and
pheromone updates, which commit together. A saved response can be replayed after
a crash without calling the provider again or duplicating a deposit.

```bash
node tools/research/cli.mjs resume --db tools/outputs/credit-assignment.sqlite
```

If a process died during a remote call without a receipt, inspect the database
and use `resume --recover` to abandon that action and continue other eligible
work. It never retries that uncertain call; its token reservation remains charged.
Failed and uncertain actions, including truncated or invalid model responses,
remain visible. Budget-exhausted runs retain partial trees. Runtime errors do not
turn into successful research results.

After a parser repair, `resume --revalidate` locally rechecks saved failed model
responses before continuing dependent work. It does not repeat the failed model
calls. Only a bare JSON object or a single surrounding JSON code fence is
accepted; schema and evidence validation still apply.

You can explicitly extend total budgets on resume with `--max-tokens`,
`--max-model-calls`, `--max-actions`, or `--max-elapsed-ms`. Increases are recorded
in `runs.config.budgetHistory`; prior usage is retained. To resume a frozen-corpus
run after moving its files, pass `--corpus` with the new location. Its content hash
must match the original corpus.

For a fixed-pool comparison, export retrieved content and create **two fresh**
databases with identical options, using `--corpus` and either policy:

```bash
node tools/research/cli.mjs export-corpus \
  --db tools/outputs/credit-assignment.sqlite \
  --out tools/outputs/credit-assignment-corpus.json
```

Add `--corpus tools/outputs/credit-assignment-corpus.json` to each new `run`
command. The corpus contains fetched sources, not claims, reviews, or pheromones.
It is a frozen candidate pool; follow searches cannot expand it. Because the
original run selected this pool, this compares scheduling over that pool, not
unbiased end-to-end retrieval. Use separately collected input pools before
making broader performance claims. Model outputs need not be deterministic even
when action selection has a fixed seed.

Keep Emergent Mind reference answers outside the runtime database and input pool.
There is no evaluator integration or claim of benchmark accuracy in this prototype.
The model receives only bounded data and has no filesystem, database, shell, or
web tools; retrieval is controlled by the executor's selected backend.

## Verification

Run the bounded executor and evidence-integrity tests without network access:

```bash
node --test tests/research-tree.test.mjs
```

## Development result

The credit-assignment question completed in
`tools/outputs/credit-assignment-passages.sqlite`: three fetched papers, three
model-reviewed trees, six model calls, 50,000 reported tokens, and about 136
seconds of recorded action time. The tree contains 69 nodes, including ten open
questions, nine related-paper/browsing leads, and two rejected structural links.
SQLite integrity and foreign-key checks passed. These are execution results;
reconstruction accuracy and an ACO advantage over greedy scheduling have not been
measured.

The initial alpha-login attempt and the earlier quote-copying extraction failures
remain in separate development databases. The successful pass reused the three
fetched source snapshots and switched extraction to passage references. Its token
reservation ceiling was explicitly increased from 60,000 to 80,000 before the last
review; actual reported usage remained 50,000. The earlier extraction-development
run used another 24,568 tokens. These numbers must not be presented as a fresh,
single-pass performance benchmark.

```bash
node tools/research/cli.mjs tree \
  --db tools/outputs/credit-assignment-passages.sqlite
node tools/research/cli.mjs answer \
  --db tools/outputs/credit-assignment-passages.sqlite
```

Paper nodes in this run are 2, 3, and 4. Attach your next level of analysis beneath
one of those IDs, or inspect the tree for a particular argument node. The files in
`tools/outputs/` are local, ignored execution artifacts.
