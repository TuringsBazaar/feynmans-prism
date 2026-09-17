// Report downstream speedup (amplification factor) on a fragment.
// Coordinator updates the fragment's velocity and contributor metrics.
//
//   pnpm fragment-velocity -- <fragmentId> <amplificationFactor> [--room pears]

import { DEFAULT_ROOM, flagString, openRoom, parseFlags, readLines, sleep, writeAll } from '../src/room.ts'
import { encodeControl, isControl } from '../src/wire.ts'

const flags = parseFlags(process.argv.slice(2))
const fragmentId = flags.positional[0]
const factorStr = flags.positional[1]

if (!fragmentId || !factorStr || isNaN(Number(factorStr))) {
  console.error('Usage: fragment-velocity -- <fragmentId> <amplificationFactor> [--room pears]')
  console.error('  amplificationFactor: e.g. 1.3 for 30% speedup')
  process.exit(1)
}

const amplificationFactor = Number(factorStr)
const room = flagString(flags, 'room', DEFAULT_ROOM)
const { swarm, discovery } = openRoom(room)

swarm.on('connection', (socket) => {
  readLines(socket, (line) => {
    if (!isControl(line)) console.log(line)
  })
})

await discovery.flushed()
await sleep(1000)

const msg = encodeControl({
  t: 'report-velocity',
  fragmentId,
  amplificationFactor,
})

const n = swarm.connections.size
if (n === 0) {
  console.log(`no coordinator in room "${room}" yet`)
} else {
  writeAll(swarm.connections, msg)
  console.log(
    `>> reported velocity ${amplificationFactor}x on fragment ${fragmentId.slice(0, 8)} to ${n} node${n === 1 ? '' : 's'}`,
  )
}

await sleep(2000)
await swarm.destroy()
process.exit(0)
