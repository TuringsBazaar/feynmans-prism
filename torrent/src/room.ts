// Transport: a room is the set of pears that share a room name and can reach
// each other over loopback or the tailnet (see transport.ts). Every pear
// listens on one port and dials every other host:port it can see; the first
// line on each connection is an id handshake, after which the socket carries
// the wire.ts protocol. This is the single module that touches sockets and
// readline, so the pear and every script share the same boilerplate.

import { EventEmitter } from 'node:events'
import type { Server, Socket } from 'node:net'
import { createInterface, type Interface } from 'node:readline'
import { ephemeralIdentity, type Identity } from './identity.ts'
import {
  detectTransport,
  dial,
  discoverHosts,
  isTrustedAddress,
  listen,
  normalizeAddress,
  PORTS,
  type Transport,
} from './transport.ts'
import { CONTROL_PREFIX } from './wire.ts'

export const DEFAULT_ROOM = 'pears'
const HANDSHAKE_MS = 3000

export interface PeerSocket extends Socket {
  remotePublicKey: Buffer
  lines: Interface
}

export interface RoomOptions {
  transport?: Transport | 'auto'
  ports?: [number, number]
  identity?: Identity
}

interface IdLine {
  t: 'id'
  key: string
  room: string
  port: number
}

function parseId(raw: string): IdLine | null {
  if (!raw.startsWith(CONTROL_PREFIX)) return null
  try {
    const m = JSON.parse(raw.slice(1))
    return m?.t === 'id' && typeof m.key === 'string' && typeof m.port === 'number' ? m : null
  } catch {
    return null
  }
}

export class Room extends EventEmitter<{ connection: [PeerSocket] }> {
  readonly connections = new Set<PeerSocket>()
  readonly id: string
  port = 0
  transport: Transport = 'local'
  private server: Server | null = null
  private readonly byKey = new Map<string, PeerSocket>()
  private readonly active = new Set<string>() // host:port dialing or connected
  private readonly known = new Map<string, string>() // host:port → key, once learned
  private readonly opening: Promise<void>

  constructor(
    readonly room: string,
    private readonly opts: RoomOptions = {},
  ) {
    super()
    this.id = (opts.identity ?? ephemeralIdentity()).id
    this.opening = this.open()
  }

  private async open() {
    const want = this.opts.transport ?? 'auto'
    this.transport = want === 'auto' ? await detectTransport() : want
    const host = this.transport === 'local' ? '127.0.0.1' : '0.0.0.0'
    const { server, port } = await listen(host, this.opts.ports ?? PORTS)
    this.server = server
    this.port = port
    server.on('connection', (socket) => this.accept(socket, false))
    await this.refresh()
  }

  // Resolves once we listen and the first sweep of dials has settled.
  ready() {
    return this.opening
  }

  // One sweep: dial every host:port we are not already talking to.
  async refresh() {
    const [lo, hi] = this.opts.ports ?? PORTS
    const hosts = await discoverHosts(this.transport)
    const dials: Promise<void>[] = []
    for (const host of hosts) {
      for (let port = lo; port <= hi; port++) {
        if (host === '127.0.0.1' && port === this.port) continue
        const ep = `${host}:${port}`
        const key = this.known.get(ep)
        if (this.active.has(ep) || (key && this.byKey.has(key))) continue
        dials.push(this.dialOne(host, port))
      }
    }
    await Promise.all(dials)
  }

  private async dialOne(host: string, port: number) {
    const ep = `${host}:${port}`
    this.active.add(ep)
    const socket = await dial(host, port)
    if (!socket) return void this.active.delete(ep)
    socket.once('close', () => this.active.delete(ep))
    await new Promise<void>((done) => this.accept(socket, true, done))
  }

  // Handshake without readline: the id line is split off by hand and the rest
  // of the chunk is unshifted, so no line that follows it can be lost.
  private accept(socket: Socket, initiator: boolean, done: () => void = () => {}) {
    socket.on('error', () => {})
    socket.once('close', done)
    if (!initiator && !isTrustedAddress(socket.remoteAddress)) return socket.destroy()
    socket.write(
      CONTROL_PREFIX + JSON.stringify({ t: 'id', key: this.id, room: this.room, port: this.port }) + '\n',
    )
    const timer = setTimeout(() => socket.destroy(), HANDSHAKE_MS)
    let buffered = Buffer.alloc(0)
    const onData = (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk])
      const nl = buffered.indexOf('\n')
      if (nl === -1) return
      clearTimeout(timer)
      socket.removeListener('data', onData)
      socket.pause()
      if (nl + 1 < buffered.length) socket.unshift(buffered.subarray(nl + 1))
      const id = parseId(buffered.subarray(0, nl).toString())
      if (!id || id.room !== this.room || id.key === this.id) return socket.destroy()
      this.register(socket, id, initiator)
      done()
    }
    socket.on('data', onData)
  }

  // Two pears that dial each other end up with two connections. Both keep the
  // one dialed by the lower key; a lone connection is kept whoever dialed it.
  private register(socket: Socket, id: IdLine, initiator: boolean) {
    const ep = initiator ? `${normalizeAddress(socket.remoteAddress)}:${id.port}` : null
    if (ep) this.known.set(ep, id.key)
    const canonical = initiator ? this.id < id.key : id.key < this.id
    const existing = this.byKey.get(id.key)
    if (existing && !canonical) return socket.destroy()
    const ps = socket as PeerSocket
    ps.remotePublicKey = Buffer.from(id.key, 'hex')
    ps.lines = createInterface({ input: socket })
    ps.lines.on('error', () => {})
    this.byKey.set(id.key, ps)
    this.connections.add(ps)
    existing?.destroy()
    socket.once('close', () => {
      ps.lines.close()
      this.connections.delete(ps)
      if (this.byKey.get(id.key) === ps) this.byKey.delete(id.key)
    })
    this.emit('connection', ps)
  }

  async close() {
    await this.opening.catch(() => {})
    for (const s of this.connections) s.destroy()
    await new Promise<void>((done) => (this.server ? this.server.close(() => done()) : done()))
  }
}

export function openRoom(room: string, opts: RoomOptions = {}): Room {
  return new Room(room, opts)
}

export function peerId(socket: PeerSocket): string {
  return socket.remotePublicKey.toString('hex')
}

// Network chunks split messages; readline reassembles complete lines. Errors
// are swallowed: a culled duplicate connection (ETIMEDOUT / ECONNRESET) would
// otherwise crash the process through readline's re-emitted error.
export function readLines(socket: PeerSocket, onLine: (line: string) => void) {
  const rl = socket.lines ?? createInterface({ input: socket })
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
