# feynman's prism

A distributed network of Feynmans churning on open research problems from
[Emergent Mind](https://www.emergentmind.com). Each *pear* is a peer in a
[Hyperswarm](https://github.com/holepunchto/hyperswarm) room that joins
problems, chats, and (later) gets assigned fragments of the research tree.
Looks like WebTorrent but instead of movies there are open problems.

![](docs/torrent-peers.png)

## torrent in 30 seconds

Needs Node.js ≥ 22.22, [pnpm](https://pnpm.io) and, for rooms of many pears, `brew install tmux`.

```bash
pnpm -C torrent install
pnpm -C torrent pear             # you are in room "pears". first pear in = coordinator = aman
```

Open a second terminal and run the last line again: the header flips to
`online · 1 peers` and the new pear is handed `guillefix`. Keys: `j`/`k` move ·
`space` join/leave a problem · `enter` expand · `m` message · `q` quit.

```bash
pnpm -C torrent orchestrator -- 5        # a whole room at once, tiled in tmux
pnpm -C torrent orchestrator -- stop
```

For a DeepSeek pear that waits for your assignments, run
`pnpm -C torrent agent -- aman --room manual-pears --name pear-1 --manual`.
Type a problem in its terminal and press Enter; subsequent lines are follow-ups.
Manual pears ignore room chat and never choose problems automatically. Use distinct
names in separate terminals for independent assignments; `PEAR_MODEL` selects the model.

## all commands

Run from the repo root. Hyperswarm commands take `--room <name>` to select a room.

| Command | What it does |
| --- | --- |
| `pnpm -C torrent pear -- [--room r] [--name n \| --index i] [--auto-join id] [--coordinator]` | one pear (Ink TUI; headless when stdin is not a TTY) |
| `pnpm -C torrent orchestrator -- [N=5] [--room r] [--join] [--terminal]` | start N pears in a tmux session (`--terminal`: macOS Terminal windows) |
| `pnpm -C torrent orchestrator -- stop [--room r]` | kill the tmux session; every pear un-announces |
| `pnpm -C torrent message -- "hi" [--room r] [--as name] [--listen 12]` | one-shot message, listen for replies, exit |
| `pnpm -C torrent transcript -- [--room r] [--every 30]` | record chat to `torrent/snapshots/<room>-<time>.md`; stdin lines are sent as `[scribe]` |
| `pnpm -C torrent agent -- <persona> [--room r]` | LLM persona pear; persona ids are the keys of the JSON block in `PEARS.md`. Needs `OPENROUTER_API_KEY` (or an opencode login); `PEAR_MODEL` overrides the model |
| `pnpm -C torrent discord` | Discord program chair with direct persona conversations and bounded delegation; setup below |
| `pnpm -C torrent discord:costs [YYYY-MM-DD]` | reported OpenRouter usage and costs for a UTC day; defaults to today |
| `pnpm -C torrent room` / `node torrent/scripts/guillefix.cjs <room>` | the original plain stdin chat client |
| `pnpm -C torrent check` | `lint` (oxlint + prettier) · `typecheck` · `test` |
| `uv sync` | Python deps for `graphs/` and `tools/` |
| `uv run helm-mirror run` | evaluate feynman research runs, HELM-style ([design](tools/helm_mirror/design.md)) |
| `just ingest` | gate: paper dumps → postgres `papers` table (needs `DATABASE_URL`) |
| `just policy "focused ultrasound"` | rwx-policy: probability distribution over papers + rwx decimals |
| `just run "focused ultrasound"` | ingest, then policy |
| `just test` · `just lint` | Python unittest · ruff |
| `node tools/research/cli.mjs --help` | one-question SQLite research tree ([docs](tools/research/README.md)) |
| `node tools/research/cli.mjs tree --db tools/outputs/credit-assignment-passages.sqlite` | inspect the completed credit-assignment tree |

Postgres for the gate: `export DATABASE_URL="postgresql://postgres@localhost:5432/propagate"`
(a local brew postgres with trust auth works).

## Discord program chair

The application being onboarded is recorded in [discord.md](discord.md). The
runtime uses the authenticated bot's Discord ID, so changing its display name
does not require changing the router. Its research role is the program chair.

1. Copy `torrent/.env.example` to `torrent/.env.local`, which is ignored by git.
   Set `DISCORD_BOT_TOKEN` from the application's **Bot** page,
   `OPENROUTER_API_KEY`, `PEAR_MODEL` to an available OpenRouter model ID, and
   `DISCORD_CHANNEL_ID` to a server text channel's ID. Discord Developer Mode
   exposes **Copy Channel ID**. An application ID is not a channel ID or token.
2. Give the bot **View Channel**, **Send Messages**, **Read Message History**,
   **Create Public Threads**, and **Send Messages in Threads** in that channel.
   Startup checks the effective permissions, including channel overrides.
3. Run one instance from the repository root:

   ```bash
   pnpm -C torrent discord
   ```

Select the bot's actual mention in Discord, then type a request:

```text
@your-bot investigate the credit assignment problem
@your-bot aman: propose a formal model
@your-bot gwern: critique Aman's assumptions
@your-bot chair: compare the two approaches
@your-bot status
@your-bot stop
```

New requests in the configured channel create a thread. Continue in that thread
to share its context; unrelated threads have separate histories. Follow-ups use
the last addressed persona; `chair:` switches back to orchestration (`noera:`
is also an alias). `representer:` and `compressor:` are available directly.
The bot posts labeled persona replies through a single Discord account.

By default every request needs a bot mention. For plain follow-ups such as
`aman: explain that bound` in existing bot threads, enable **Message Content
Intent** in the Discord Developer Portal and set `DISCORD_MESSAGE_CONTENT=1`.
See [Discord Gateway intents](https://docs.discord.com/developers/events/gateway).
The bot ignores other channels, bots, and webhook messages. Optional
`DISCORD_USER_IDS` restricts callers to comma-separated user IDs; otherwise
everyone who can participate in the configured channel can submit requests.

The chair creates a validated plan for Aman and Gwern, runs those two workers
concurrently, optionally calls Representer, and synthesizes one round. Each run
allows at most five model calls, each with a 1,200-token output limit and a
120-second request timeout. Input is bounded to 32,000 characters per call;
the output limit is not a total-token or dollar spending cap. Two conversations
can run at once, with one active run per thread. Busy requests receive a retry
message. `status` reports progress; the initiating user can `stop` a run or
`resume` its last request as a new run. Resuming can incur new charges.

Edit [PEARS.md](PEARS.md) to change personas, then restart. It is the shared
source for Discord and the Hyperswarm agent; the former `personas.json` has
been migrated there. The Discord workers are model conversations in one local
process. They do not yet browse papers, execute experiments, or dispatch to
remote Hyperswarm peers. Treat generated references as unverified.

Events and [OpenRouter-reported usage](https://openrouter.ai/docs/cookbook/administration/usage-accounting)
are appended under `torrent/snapshots/discord/`, with UTC daily ledgers and
conversation checkpoints every 30 seconds and at state changes. The logger
does not call a model automatically. Restarted active runs are marked interrupted;
send `resume` in their thread to start them again with saved context. Costs
missing from provider responses remain unknown. Cancellation stops local work,
but provider charges for interrupted requests may not appear in the ledger.
Use Ctrl-C to stop the process. Local transcript files are ignored by git.

Verification: `pnpm -C torrent check`. Live smoke: start the bot, mention it with
`aman: say hello`, check the new thread, then try a chair request, `status`, and
`stop`. Run `pnpm -C torrent discord:costs` to inspect reported usage.

## how the torrent works

There is no server. A room is a DHT topic (`sha256(room)`); every process that
joins it finds the others.

**Naming.** One pear per room is the *coordinator* and owns the stack of free
names (`aman guillefix alex yoyo lucy`, then `aayush … gwern`). A pear that
starts into an empty room becomes coordinator immediately and takes `aman`.
Every later pear starts as `waiting for name…`, asks the coordinator, and is
handed the next name off the stack. If the coordinator quits, the remaining
pear with the earliest name takes over; freed names go back on the stack. The
header shows who is coordinating. `--name`/`--index` pin a name that is never
yielded.

**Messages.** Press `m`, type, `enter`. Messages go to every connected peer as a
plain line `[name] text` — the same format the upstream
[pear-to-pear](https://github.com/exanova-y/pear-to-pear) tools use, so a pear,
`guillefix.cjs`, `message`, `transcript` and the LLM agents all share one room.
The pear's own control protocol (hellos, joins, name requests) travels on the
same sockets as JSON lines prefixed with `U+001F`; every client skips those, so
humans only see chat.

**Orchestrator.** Pear #0 gets `--coordinator`; the others ask it for names, so
everyone is named within a round-trip. `--join` gives each pear a different
problem. `stop` kills the tmux session, which SIGHUPs every pear so it
un-announces cleanly. Without tmux (or with `--terminal`) it opens one macOS
Terminal window per pear instead; quit those with `q`.

**Personas** are the JSON block in [PEARS.md](PEARS.md) (read at startup by the
LLM agents). The `stirrer` walks the problem list in `torrent/src/data.ts`, the
single source of truth for names and problems.

### troubleshooting

- **`connecting · 0 peers` for a long time.** A fresh room connects in 1–2 s.
  The public `pears` topic can be slow (20–30 s) when it holds stale
  announcements from pears that were killed hard; they expire on their own.
  Any other `--room` is instant meanwhile.
- **Phantom peers or wrong names.** Look for leftover processes:
  `pgrep -fl pear.tsx`, then `pkill -f pear.tsx`. Pears un-announce on `q`,
  Ctrl-C, SIGTERM and SIGHUP, so this should only happen after a hard kill.
- **Two coordinators.** Two pears that both started into an apparently empty
  room self-elect; on meeting, the earlier start wins, the other gives up its
  name and asks the winner for one. Harmless.

## repo map

```
README.md  AGENT.md  DESIGN.md  CONTEXT.md  CHANGELOG.md  PEARS.md
torrent/        the pear: p2p client over hyperswarm (TypeScript, Ink)
  src/          wire · room · state · send · presence · naming · peer · lifecycle · ui/ · pear.tsx (entry) · discord/ (wip)
  scripts/      orchestrator · message · transcript · agent · guillefix.cjs
  tests/        node:test over the pure modules (wire, room, naming)
autoresearch/   vendored feynman autoresearch
tools/          helm_mirror (evaluator) · research (SQLite research tree) · instructions · outputs/ (untracked)
graphs/         corpus/ (paper dumps, open problems) · corpus_ingest/ (gate, rwx policy)
tests/          Python + node tests for graphs and tools
docs/           in-short.md (the proposal), images
```

Style and limits for contributors and agents: [AGENT.md](AGENT.md). Design
notes: [DESIGN.md](DESIGN.md). History and scrap notes: [CONTEXT.md](CONTEXT.md).
Acoustics (CT viewer, jwave simulation) moved to
[exanova-y/propagate-yourself](https://github.com/exanova-y/propagate-yourself).
