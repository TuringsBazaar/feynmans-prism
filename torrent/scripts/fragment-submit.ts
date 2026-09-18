// Submit a fragment (solution to a subproblem) into the room.
// The coordinator receives it and updates metrics.
//
//   pnpm fragment-submit -- <problemId> <subproblemId> <content> [--room pears] [--spawns "q || q"]
//
// --spawns lists subproblems uncovered while solving, separated by "||"; the
// coordinator adds them to the graph as children of the solved node.

import { DEFAULT_ROOM, flagString, openRoom, parseFlags, readLines, sleep, writeAll } from '../src/room.ts'
import { encodeControl, isControl } from '../src/wire.ts'

const flags = parseFlags(process.argv.slice(2))
const problemId = flags.positional[0]
const subproblemId = flags.positional[1]
const content = flags.positional.slice(2).join(' ')

if (!problemId || !subproblemId || !content) {
  console.error('Usage: fragment-submit -- <problemId> <subproblemId> <content> [--room pears]')
  process.exit(1)
}

const room = flagString(flags, 'room', DEFAULT_ROOM)
const spawns = flagString(flags, 'spawns', '')
  .split('||')
  .map((s) => s.trim())
  .filter(Boolean)
const pears = openRoom(room)

pears.on('connection', (socket) => {
  readLines(socket, (line) => {
    if (!isControl(line)) console.log(line)
  })
})

await pears.ready()
await sleep(1000)

const msg = encodeControl({
  t: 'submit-fragment',
  problemId,
  subproblemId,
  content,
  spawns,
})

const n = pears.connections.size
if (n === 0) {
  console.log(`no coordinator in room "${room}" yet`)
} else {
  writeAll(pears.connections, msg)
  console.log(`>> submitted fragment to ${n} node${n === 1 ? '' : 's'}`)
}

await sleep(2000)
await pears.close()
process.exit(0)
