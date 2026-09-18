// The pear: one process = one peer in a room. It finds the other pears over
// loopback or the tailnet, gossips which problems it has joined, chats with
// them, and paints a box-drawn terminal UI (or, headless, forwards stdin
// lines as chat).
//
// Module map (dependency order):
//   wire      protocol encoding/decoding, pure
//   identity  persistent ed25519 keypair (~/.feynman/identity.json)
//   transport where pears live (loopback / tailscale), listen and dial
//   room      handshake, dedupe, readline; shared with scripts/
//   state     live state + snapshot for Ink
//   send      outbound control/chat
//   presence  join / leave / say
//   naming    coordinator election and device-name collisions
//   peer      inbound connection handling
//   lifecycle online, refresh, shutdown
//   ui        Ink widgets and keys
//
// Run: pnpm pear -- [--room r] [--name n | --index i] [--auto-join id] [--coordinator] [--local] [--home dir]

import { render } from 'ink'
import { createInterface } from 'node:readline'
import { parsePearArgs } from './args.ts'
import { loadIdentity } from './identity.ts'
import { goOnline } from './lifecycle.ts'
import { becomeCoordinator } from './naming.ts'
import { onConnection } from './peer.ts'
import { say } from './presence.ts'
import { openRoom } from './room.ts'
import { self } from './state.ts'
import { App } from './ui/App.tsx'

const opts = parsePearArgs(process.argv.slice(2))
const identity = loadIdentity(opts.home)
const room = openRoom(opts.room, { identity, transport: opts.local ? 'local' : 'auto' })

self.id = room.id
self.home = opts.home
self.name = opts.name ?? identity.device
self.fixedName = opts.name !== null

room.on('connection', onConnection)
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
