# Fragment System: Solve Velocity & Amplification Factor

Peers submit research fragments (solutions) and report downstream speedups. The coordinator tracks two metrics per peer:

- **Solve Velocity** — fragments submitted per hour
- **Amplification Factor** — average downstream speedup (1.3x = 30% faster)

Later: velocity scores will drive compute allocation (high contributors get priority).

## Usage

### Announce compute capacity
```bash
pnpm fragment-compute -- 100 --room pears                    # 100 units, researcher
pnpm fragment-compute -- 50 --role provider --room pears     # 50 units, provider
```

### Submit a fragment
```bash
pnpm fragment-submit -- credit-assignment q1 "answer here" --room pears
```
Arguments: problemId, subproblemId, content.

### Report velocity (downstream speedup)
```bash
pnpm fragment-velocity -- abc12345 1.3 --room pears          # 30% speedup
pnpm fragment-velocity -- abc12345 0.9 --room pears          # 10% slowdown
```
Arguments: fragmentId (shown in coordinator logs), amplificationFactor.

### Submit a fragment that uncovered new subproblems
```bash
pnpm fragment-submit -- credit-assignment q1 "answer" --spawns "does it hold for conv nets? || and spiking?" --room pears
```
The solved node gets those as children (`q11`, `q12`, …) that required it, and
the feed says which already-listed nodes the fragment unlocked.

### Propose and review subproblems
```bash
pnpm propose -- credit-assignment "a human idea" --parent q2 --room pears   # queued
pnpm review -- --room pears                                                   # list the queue
pnpm review -- --approve all --room pears                                     # or --approve 1,2 --reject 3
```
Proposals pile up and are settled in batches; in the TUI `p` proposes and `r`
(coordinator) approves everything pending.

## Coordinator State

The coordinator (first peer in room, or re-elected on departure) maintains an in-memory ledger:

- **Fragments** — all submitted solutions + amplification factors
- **Compute Providers** — announced capacity per peer
- **Peer Metrics** — solve velocity + avg amplification per contributor
- **Problem graph** — `<home>/graph.sqlite`: nodes (`q1…`), requires-edges with
  pheromone weights, proposal queue. Broadcast as a snapshot after each change;
  see "Problem graph" in README.md.

Logged to feed on each event. Example:

```
10:23:45  Fragment abc12345 submitted to q1
10:24:10  Fragment abc12345 velocity: 1.30x (avg: 1.25x)
10:24:15  aman announces 100 units (researcher)
```

## Next Steps

- Wire into TUI to show metrics next to peer names
- Use velocity scores to weight fragment assignment, over `readySet` of the graph
- Persist the ledger beside the graph in `graph.sqlite` for cross-session tracking
