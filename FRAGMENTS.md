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

## Coordinator State

The coordinator (first peer in room, or re-elected on departure) maintains an in-memory ledger:

- **Fragments** — all submitted solutions + amplification factors
- **Compute Providers** — announced capacity per peer
- **Peer Metrics** — solve velocity + avg amplification per contributor

Logged to feed on each event. Example:

```
10:23:45  Fragment abc12345 submitted to q1
10:24:10  Fragment abc12345 velocity: 1.30x (avg: 1.25x)
10:24:15  aman announces 100 units (researcher)
```

## Next Steps

- Wire into TUI to show metrics next to peer names
- Use velocity scores to weight fragment assignment
- Persist ledger to disk (RocksDB or SQLite) for cross-session tracking
