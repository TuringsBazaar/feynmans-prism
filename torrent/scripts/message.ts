// One-shot message into a room, then listen briefly for replies and exit.
// Port of pear-to-pear/probe.mjs; speaks the shared "[name] text" chat format.
//
//   pnpm message -- "hello pears" [--room pears] [--as probe] [--listen 12]

import {
  DEFAULT_ROOM,
  flagString,
  openRoom,
  parseFlags,
  peerId,
  readLines,
  sleep,
  writeAll,
} from '../src/room.ts'
import { encodeChat, isControl } from '../src/wire.ts'

const flags = parseFlags(process.argv.slice(2))
const room = flagString(flags, 'room', DEFAULT_ROOM)
const as = flagString(flags, 'as', 'probe')
const listenSec = Number(flagString(flags, 'listen', '12'))
const text = flags.positional.join(' ') || 'Hello pears, who is here?'

const pears = openRoom(room)
pears.on('connection', (socket) => {
  const id = peerId(socket).slice(0, 8)
  readLines(socket, (line) => {
    if (!isControl(line)) console.log(`[${id}] ${line}`)
  })
})

await pears.ready()
await sleep(4000) // let the first sweep of dials and handshakes settle

const n = pears.connections.size
if (n === 0) console.log(`no peers in room "${room}" yet; message not sent`)
else {
  writeAll(pears.connections, encodeChat(as, text))
  console.log(`>> sent to ${n} peer${n === 1 ? '' : 's'}: [${as}] ${text}`)
}

await sleep(listenSec * 1000)
await pears.close()
process.exit(0)
