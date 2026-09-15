// The pear: one process = one peer in a Hyperswarm room. It joins the room,
// gossips which problems it has joined, chats with the other pears, and paints
// a box-drawn terminal UI (or, headless, forwards stdin lines as chat).
//
// Module map (dependency order):
//   wire      protocol encoding/decoding, pure
//   room      hyperswarm + readline transport, shared with scripts/
//   state     live state + snapshot for Ink
//   send      outbound control/chat
//   presence  join / leave / say
//   naming    coordinator election and the free-name stack
//   peer      inbound connection handling
//   lifecycle online, refresh, shutdown
//   ui        Ink widgets and keys
//
// Run: pnpm pear -- [--room r] [--name n | --index i] [--auto-join id] [--coordinator]

import { render } from 'ink'
import { createInterface } from 'node:readline'
import { parsePearArgs } from './args.ts'
import { goOnline } from './lifecycle.ts'
import { becomeCoordinator } from './naming.ts'
import { onConnection } from './peer.ts'
import { say } from './presence.ts'
import { openRoom } from './room.ts'
import { self } from './state.ts'
import { App } from './ui/App.tsx'

const opts = parsePearArgs(process.argv.slice(2))
const room = openRoom(opts.room)

self.id = room.id
self.name = opts.name
self.fixedName = opts.name !== null
self.pendingAutoJoin = opts.autoJoin

room.swarm.on('connection', onConnection)
if (opts.coordinator) becomeCoordinator('--coordinator')
goOnline(room, opts.autoJoin)

// Ink needs raw-mode stdin; only mount the UI in an interactive terminal.
// Headless (stdin not a TTY): each stdin line is sent as chat, like guillefix.
if (process.stdin.isTTY) render(<App />)
else {
  const stdin = createInterface({ input: process.stdin })
  stdin.on('line', say)
  stdin.on('error', () => {})
}
