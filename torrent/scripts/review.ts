// List the coordinator's proposal queue, or settle a batch of it.
//
//   pnpm review -- [--room pears]                    list pending proposals
//   pnpm review -- --approve all|1,2 [--reject 3]    settle
//
// The queue arrives as `graph` snapshots the coordinator sends on hello, one
// per problem; the script waits briefly for them before printing.

import { DEFAULT_ROOM, flagString, openRoom, parseFlags, readLines, sleep, writeAll } from '../src/room.ts'
import type { Proposal } from '../src/tree.ts'
import { encodeControl, parseControl, type ControlOf } from '../src/wire.ts'

const flags = parseFlags(process.argv.slice(2))
const room = flagString(flags, 'room', DEFAULT_ROOM)
const approveArg = flagString(flags, 'approve', '')
const rejectArg = flagString(flags, 'reject', '')
const ids = (s: string) => s.split(',').map(Number).filter(Number.isInteger)

const pending = new Map<number, Proposal>()
const pears = openRoom(room)
pears.on('connection', (socket) => {
  readLines(socket, (line) => {
    const m = parseControl(line)
    if (m?.t !== 'graph') return
    for (const p of (m as ControlOf<'graph'>).pending ?? []) pending.set(p.id, p)
  })
})

await pears.ready()
await sleep(1500)

if (pears.connections.size === 0) {
  console.log(`no coordinator in room "${room}" yet`)
} else if (!approveArg && !rejectArg) {
  if (!pending.size) console.log('no proposals pending')
  for (const p of [...pending.values()].toSorted((a, b) => a.id - b.id)) {
    console.log(
      `#${p.id}  ${p.problemId}${p.parentId ? `/${p.parentId}` : ''}  by ${p.proposer}\n     ${p.text}`,
    )
  }
} else {
  const approve = approveArg === 'all' ? [...pending.keys()] : ids(approveArg)
  const reject = ids(rejectArg)
  writeAll(pears.connections, encodeControl({ t: 'review-proposals', approve, reject }))
  console.log(`>> approve ${approve.join(',') || '—'} · reject ${reject.join(',') || '—'}`)
  await sleep(1500)
}

await pears.close()
process.exit(0)
