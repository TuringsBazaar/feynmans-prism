// Transport: one Hyperswarm room = one DHT topic (sha256 of the room name).
// Every process that joins the topic finds the others; there is no server.
// This module is the single place that touches hyperswarm and readline, so the
// pear and every script share the same boilerplate.

import Hyperswarm, { type Discovery, type PeerSocket } from 'hyperswarm'
import { createHash, randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline'

export type { Discovery, PeerSocket }

export const DEFAULT_ROOM = 'pears'

export interface Room {
  room: string
  swarm: Hyperswarm
  discovery: Discovery
  id: string // our public key, hex
}

export function topicFor(room: string): Buffer {
  return createHash('sha256').update(room).digest()
}

// Joins as both server and client so any two pears can find each other.
export function openRoom(room: string): Room {
  const swarm = new Hyperswarm()
  let id: string
  try {
    id = Buffer.from(swarm.keyPair.publicKey).toString('hex')
  } catch {
    id = randomBytes(8).toString('hex')
  }
  const discovery = swarm.join(topicFor(room), { server: true, client: true })
  return { room, swarm, discovery, id }
}

export function peerId(socket: PeerSocket): string {
  return socket.remotePublicKey.toString('hex')
}

// Network chunks split messages; readline reassembles complete lines. Errors
// are swallowed: a culled duplicate connection (ETIMEDOUT / ECONNRESET) would
// otherwise crash the process through readline's re-emitted error.
export function readLines(socket: PeerSocket, onLine: (line: string) => void) {
  const rl = createInterface({ input: socket })
  rl.on('line', onLine)
  rl.on('error', () => {})
  socket.on('error', () => {})
  socket.on('close', () => rl.close())
  return rl
}

export function writeAll(sockets: Iterable<PeerSocket>, line: string) {
  for (const s of sockets) s.write(line)
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// Tiny flag parser: "--key value" pairs, bare "--flag" booleans, the rest
// positional. A lone "--" is skipped: pnpm forwards it from `pnpm run x -- args`.
export interface Flags {
  opts: Record<string, string | true>
  positional: string[]
}

export function parseFlags(argv: string[], booleans: string[] = []): Flags {
  const opts: Record<string, string | true> = {}
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') continue
    else if (!a.startsWith('--')) positional.push(a)
    else if (booleans.includes(a.slice(2))) opts[a.slice(2)] = true
    else opts[a.slice(2)] = argv[++i]
  }
  return { opts, positional }
}

export function flagString(flags: Flags, key: string, fallback: string): string {
  const v = flags.opts[key]
  return typeof v === 'string' ? v : fallback
}
