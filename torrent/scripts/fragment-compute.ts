// Announce compute capacity into the room.
// Coordinator adds the peer to its compute provider ledger.
//
//   pnpm fragment-compute -- <computeUnits> [--role provider|researcher|hybrid] [--room pears]

import { DEFAULT_ROOM, flagString, openRoom, parseFlags, readLines, sleep, writeAll } from '../src/room.ts'
import { encodeControl, isControl } from '../src/wire.ts'

const flags = parseFlags(process.argv.slice(2))
const unitsStr = flags.positional[0]

if (!unitsStr || isNaN(Number(unitsStr))) {
  console.error(
    'Usage: fragment-compute -- <computeUnits> [--role provider|researcher|hybrid] [--room pears]',
  )
  console.error('  computeUnits: e.g. 100')
  process.exit(1)
}

const computeUnits = Number(unitsStr)
const role = (flagString(flags, 'role', 'researcher') as 'provider' | 'researcher' | 'hybrid') || 'researcher'
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
  t: 'compute-provide',
  computeUnits,
  role,
})

const n = swarm.connections.size
if (n === 0) {
  console.log(`no coordinator in room "${room}" yet`)
} else {
  writeAll(swarm.connections, msg)
  console.log(`>> announced ${computeUnits} units (${role}) to ${n} node${n === 1 ? '' : 's'}`)
}

await sleep(2000)
await swarm.destroy()
process.exit(0)
