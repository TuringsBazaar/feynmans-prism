## feynman's prism
- better feature representation of the feynman autoresearch agent during research process
- also includes a torrent client within a pear-to-pear network

![](via-egnatia.png)
![](torrent-peers.png)


## features
0) a p2p network
pears can join the network to solve open problems from emergent mind, resembling a webtorrent client.
- initial pears are randomly named, i.e. aman, guillefix, alex, yoyo, lucy
- subsequent pears: aayush, sudarsh, lev, celeste, ada, lydia, malaika, pavrati, yudhister, amir, ihar, gwern

a thin terminal wireframe client lives in `torrent/` (`tui.mjs`). each process is
one randomly-named pear that joins the shared `pears` hyperswarm room and gossips
which open problems it's joined. peer counts, join state, and token counts render
in a box-drawn wireframe; "who joined what" streams below it.

```bash
cd torrent
npm install
npm run pear          # one pear (random name), interactive wireframe
npm run spawn         # open 5 Terminal.app windows, one pear each (macOS)
```

or directly:

```bash
node torrent/tui.mjs pears                            # random name
node torrent/tui.mjs pears aman credit-assignment     # force a name, auto-join a problem
```

keys: `j`/`k` or arrows move · `space` join/pause · `enter` expand a problem · `q` quit.
the problem roster and token counts come from `torrent/data.mjs`.


1) a simple ct viewer to sanity check downloaded ct in `acoustics/`
install [uv](https://docs.astral.sh/uv/), then:
```
uv sync
```
`uv run python acoustics/view_ct.py`

keys: `z` axial, `y` coronal, `x` sagittal (key = scrubbed axis)

2) an evaluation tool for feynman research runs. it uses the [stanford helm](https://github.com/stanford-crfm/helm/blob/main/docs/code.md) design. time and token usage are tracked. [more information](tools/helm_mirror/design.md)

`uv run helm-mirror run`

under the `tools/` directory, the problem set lives in `instructions`. you can configure runs in `run_specs.yaml`, evaluation results land in `outputs/`. the extensive feynman artifacts are in its own directory under `autoresearch/runs/`

3) a gate that ingests paper dumps into postgres, and a policy for reading

rough markdown corpora live in `graphs/corpus/`. the `gate` moves papers three
ways: it parses the dump(s), resolves each entry against arxiv (and openalex /
europepmc fallbacks), then reconciles the `papers` table in postgres — the
table is the gate's only output. research taste is written by hand in
`graphs/corpus_ingest/rwx.md`.

inputs to the whole system are the dumps (`paper-dump.md`, `nano-dump.md`) and
the policy (`rwx.md`); the only persisted output is the `papers` table. the
flow is one-way: `gate` writes the table, `rwx-policy` reads it.

`rwx-policy` ranks papers against the active heuristics in `rwx.md`, scoring
each paper on four axes — entropy, compression, implementation, and
methodological integrity — then marks each top result `accept`/`calibrate` via
the H4 optimal stopping rule. its output is terminal-only: a probability
distribution over papers plus the rwx decimals (read/write/execute). progress
is logged via `logger.info` (e.g. `fetched question`, `computing among
nano-dump`, `finished scoring papers`, `computing rwx decimals`).

requires `just` and a postgres database with `DATABASE_URL` set. a local brew
postgres works with trust auth:

```bash
export DATABASE_URL="postgresql://postgres@localhost:5432/propagate"
just ingest                           # gate: dumps -> papers table
just policy "focused ultrasound"      # terminal: probability dist + rwx decimals
just run "focused ultrasound"         # ingest, then policy
just test                             # run the test suite
just lint                             # ruff check + format
```

## setup

## quickstart

For the one-question, SQLite-backed research tree:

```bash
node tools/research/cli.mjs --help
```

The executor uses Feynman's model and paper-retrieval libraries directly. ACO
selects research actions; papers, central arguments, open questions, and related
papers are stored as an appendable tree with stable node IDs. See
[setup, running, and appending analysis](tools/research/README.md).

Inspect the completed development tree:

```bash
node tools/research/cli.mjs tree --db tools/outputs/credit-assignment-passages.sqlite
```

## to stop a script
`pkill -f view_ct.py`


## where's your head at??? 
for `1HNA013/ct.mha` from synrad2025 sCT dataset,\
x: 180 - 380\
y: 20 - 320\
z: 55 - 130
