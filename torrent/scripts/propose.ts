// Propose a subproblem. It lands in the coordinator's review queue and becomes
// a node of the problem graph once a batch is approved (`pnpm review`).
//
//   pnpm propose -- <problemId> "<text>" [--parent q3] [--room pears]

import { DEFAULT_ROOM, flagString, openRoom, parseFlags, readLines, sleep, writeAll } from '../src/room.ts'
import { encodeControl, isControl } from '../src/wire.ts'

const flags = parseFlags(process.argv.slice(2))
const problemId = flags.positional[0]
const text = flags.positional.slice(1).join(' ')

if (!problemId || !text) {
  console.error('Usage: propose -- <problemId> "<text>" [--parent q3] [--room pears]')
  process.exit(1)
}

const parent = flags.opts.parent
const room = flagString(flags, 'room', DEFAULT_ROOM)
const pears = openRoom(room)

pears.on('connection', (socket) => {
  readLines(socket, (line) => {
    if (!isControl(line)) console.log(line)
  })
})

await pears.ready()
await sleep(1000)

const n = pears.connections.size
if (n === 0) console.log(`no coordinator in room "${room}" yet`)
else {
  writeAll(
    pears.connections,
    encodeControl({
      t: 'propose-subproblem',
      problemId,
      parentId: typeof parent === 'string' ? parent : null,
      text,
    }),
  )
  console.log(`>> proposed for ${problemId} to ${n} node${n === 1 ? '' : 's'}`)
}

await sleep(2000)
await pears.close()
process.exit(0)
