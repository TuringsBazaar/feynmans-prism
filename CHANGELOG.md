# Changelog

Newest first, start with yyyy-mm-dd in title


## 2026-09-17 — One-command DeepSeek rooms

- Added `just pears [count] [room]`, plus attach, restart, and stop recipes.
- Extended the orchestrator with manual DeepSeek agents, named panes, and multiple windows for larger groups.
- Validate counts, room names, and credentials before restart; reopen existing rooms without duplicating agents.

## 2026-09-16 — Tit for Tat system from BitTorrent, Validation metrics for research fragments and coordinator assignment

**Solve Velocity & Amplification Factor:** Core mechanic to track peer productivity and research quality.
- **Solve Velocity** (fragments/hour): measures how fast a peer churns through work
- **Amplification Factor** (1.3x, etc): downstream speedup from a fragment; accumulates across submitted work
- Replaces peer-review scoring; avoids the arxiv problem where reviewer scores ≠ paper quality

**Wire protocol:** Added `submit-fragment`, `report-velocity`, `compute-provide`, `assign-fragment`, `chat` messages
- Peers announce compute capacity; coordinator tracks in ledger
- Fragments accumulated per contributor with amplification history
- Assignment algorithm weights peers by velocity (10x) + amplification (5x); round-robin distribute work
- Assignments announced so all peers see load distribution

**Discord bot as "Recorder + Stirrer":**
- Connects to Hyperswarm rooms; passively logs all fragment activity
- Commands: `!record [N]` show last N events, `!stir <msg>` inject message, `!fragment-submit`, `!announce-compute`
- Displays fragment submissions, velocity reports, compute announcements, peer joins in feed

**Display fix:** Peers now show as `hash [name]` (e.g. `a1b2c3d4 [aman]`), or just hash if name unavailable
- 5-second timeout on name requests so peers don't hang
- Both hash and name displayed on join for clarity

**Tests:** Dummy trees (problems 1–25 nodes), 3-peer scenarios, metric accumulation, scoring validation


## 2026-09-14 — Introduced context through multiple docs, featuring ousterhout coding principles, reduced cognitive complexity, 

Goal: any human or agent understands the repo in 30 seconds, and can torrent
within 30 seconds of reading README.md. Rules applied: AGENT.md (≤35-line
functions, ≤300-line files, one place for run commands, changes logged here).

### Stage 1 — repo shape

- **acoustics/ moved out** to [exanova-y/propagate-yourself](https://github.com/exanova-y/propagate-yourself)
  via `git subtree split` (history preserved; the gitignored `dataset/` was
  moved along). Zero code coupling existed, but it owned 6 of 8 Python deps.
- `pyproject.toml`: project renamed `propagate-yourself` → `feynmans-prism`;
  dropped jax, jwave, matplotlib, napari, numpy, simpleitk. Left: psycopg,
  pyyaml. `uv sync` + `just test` + `just lint` pass.
- Deleted root `package.json`, `package-lock.json`, `node_modules/` (declared
  only hyperswarm; nothing at root used it — all consumers live in `torrent/`).
- Deleted root `.gitkeep` (a stale list of directory names).
- Moved `in-short.md`, `via-egnatia.png`, `torrent-peers.png` → `docs/`.
- `tmux` installed (`brew install tmux`) so the orchestrator uses tiled panes.

### Stage 2 — torrent pruned, toolchain

- **Deleted the React/Vite web UI** (`torrent/src/*` old tree, `index.html`,
  `vite.config.ts`, `public/`, `dist/`, `tsconfig.app/node/tui.json`,
  `eslint.config.js`). Its WebSocket sidecar `server/pear.cjs` had already been
  removed, so it could never connect; `data.mjs` documented it as superseded.
  The two WebTorrent-style click sounds are kept in `torrent/assets/` for the
  DESIGN.md join/leave sound, to be wired into the TUI later.
- npm → **pnpm** (`pnpm-lock.yaml`), ESLint → **oxlint** + **Prettier**
  (`.oxlintrc.json` enforces `max-lines-per-function: 35`,
  `max-lines: 300`; `.prettierrc`). One `tsconfig.json` covering
  `src/ scripts/ tests/` — the pear is now type-checked (previously excluded).
- Dependencies removed: vite, @vitejs/plugin-react, react-dom, @types/react-dom,
  ws, @types/ws, eslint, typescript-eslint, eslint-plugin-react-hooks,
  eslint-plugin-react-refresh, @eslint/js, globals. Added: oxlint, prettier.
- Scripts: `pear room orchestrator message transcript agent lint fmt typecheck test check`.

### Stage 3 — tui.tsx (731 lines) decomposed

- `torrent/src/` now has one module per domain, acyclic in this order:
  `wire` (protocol, pure) → `room` (hyperswarm/readline transport, shared with
  scripts) → `state` (live state + Ink snapshot) → `send` → `presence`
  (join/leave/say) → `naming` (coordinator stack + election) → `peer`
  (inbound handling) → `lifecycle` (online/refresh/shutdown) → `ui/`
  (`widgets.tsx`, `keys.ts`, `App.tsx`) → `pear.tsx` (entry). Largest file
  178 lines; largest function under 35.
- Mutable cross-module values (`myName`, `isCoordinator`, cursor…) became
  fields on exported `self` / `ui` objects in `state.ts`, since ES modules
  cannot reassign imported `let`s.
- `data.mjs` + the web UI's `problems.ts` merged into **`src/data.ts`**: short
  `title` for the terminal, full Emergent Mind `statement`, all 10
  credit-assignment subproblems (was 3), tokens 50k. Expanding a problem now
  shows the statement above its subproblems.
- `scripts/*.mjs` ported to TypeScript on `room.ts`/`wire.ts` — the copy-pasted
  topic/connection/readline/`U+001F`-skip/arg-loop boilerplate (5 copies) is
  gone. `guillefix.cjs` moved to `scripts/` **verbatim** and is excluded from
  Prettier. Commands inside the scripts now spawn `pnpm pear`.
- `parseFlags` skips a lone `--` because pnpm forwards it from `pnpm run x -- args`.
- Tests (`node:test` via tsx): `wire`, `room`, `naming` (`pickCoordinator`,
  `popFreeName`, `nameRank`). `pnpm -C torrent check` is green.
- **Behaviour fix** found in the smoke test: when two pears both self-elected
  and met, the loser broadcast its hello *before* giving up its name, so the
  winner saw a plain member wearing its own name and renamed itself (room ended
  with coordinator `alex`, not `aman`). `demoteCoordinator` now nulls the name
  first. Verified: orchestrator ×3 → `aman` coordinator, `guillefix`, `alex`.
- The `stirrer` persona now announces the full problem `statement` (was the
  short title).
- Smoke-tested in tmux: naming, join propagation, `enter` expand, `m` chat,
  `message` probe, `guillefix.cjs` interop, `q`/`stop` leave zero
  `pgrep -f pear.tsx` ghosts.

### Stage 4 — docs

- `README.md` rewritten: "torrent in 30 seconds" first, then **one table with
  every run command** (torrent, python/just, research tree), then how the
  torrent works + troubleshooting (moved from `torrent/README.md`, now
  deleted), then a repo map.
- `DESIGN.md`: `@STYLE.md` → `AGENT.md`, stack line updated, image path → `docs/`.

### Concurrent work noticed (not mine, left untouched)

While this pass ran, another editor moved personas from `torrent/personas.json`
into a JSON block in `PEARS.md` (`src/personas.ts`, `scripts/agent.ts`), added
`discord.js` and `src/discord/`. As of this entry `src/discord/model.ts` and
`runner.ts` have TypeScript errors and four files fail `prettier --check`;
`pnpm -C torrent check` will stay red until that lands.

### Open (from AGENT.md, no code yet)

- OpenRouter token-cost tracking per day of development.
- W&B / Cloudflare observability.
- Discord channel for agents (in progress by the other editor).
- Join/leave sounds in the TUI (`torrent/assets/*.wav`, e.g. via `afplay`).
# 2026-09-14 — Discord research orchestration

- Added `pnpm -C torrent discord`: a channel-scoped Discord bot with per-thread
  conversations, direct persona routing, and program-chair delegation to Aman,
  Gwern, and optionally Representer.
- Added validated planning, cancellation, duplicate-event suppression, saved
  context, restart recovery, bounded calls, and a daily OpenRouter usage ledger.
- Migrated `torrent/personas.json` into the JSON block in `PEARS.md`; both room
  agents and Discord use the shared validated loader.
- Added environment setup and run instructions to README. No bot credentials
  are stored in source; live server verification requires local configuration.
- Verified with TypeScript lint, typecheck, and automated tests covering routing,
  orchestration, cancellation, failures, persistence, persona loading and metering.
