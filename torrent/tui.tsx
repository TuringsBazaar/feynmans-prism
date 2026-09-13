// torch: a terminal wireframe for the feynmans pear swarm, rendered with Ink.
//
// Each process is one pear. It joins the shared hyperswarm "pears" room,
// gossips which problems it has joined, and paints a box-drawn wireframe.
// "Who joined what" streams below it.
//
// Names are unique and ordered: the first five pears take the initial names
// (aman…lucy), later pears the subsequent list (aayush…gwern). Use `--index n`
// for a deterministic name, or `--name x`. An auto-claimed name re-claims the
// next free name on collision.
//
//   npm run pear                        # room "pears", auto-claimed name
//   npm run pear -- --index 3           # PEAR_NAMES[3]
//   npm run pear -- --name aman --auto-join credit-assignment
//
// Keys: [j/k] or arrows move · [space] join/pause · [enter] expand · [q] quit

import Hyperswarm from 'hyperswarm'
import { createHash, randomBytes } from 'node:crypto'
import readline from 'node:readline'
import { render, Box, Text, useApp, useInput } from 'ink'
import { create } from 'zustand'
import { PEAR_NAMES, PROBLEMS } from './data.mjs'

// ---- args ------------------------------------------------------------------

const args = process.argv.slice(2)
const ROOM = args[0] && !args[0].startsWith('--') ? args[0] : 'pears'

let nameArg: string | null = null
let autoJoin: string | null = null
let indexArg: number | null = null
for (let i = 1; i < args.length; i++) {
  const a = args[i]
  if (a === '--index') indexArg = Number(args[++i])
  else if (a === '--name') nameArg = args[++i]
  else if (a === '--auto-join') autoJoin = args[++i]
  else if (i === 1 && nameArg === null) nameArg = a
  else if (autoJoin === null) autoJoin = a
}

// ---- identity --------------------------------------------------------------

const topic = createHash('sha256').update(ROOM).digest()
const swarm = new Hyperswarm()

let id: string
try {
  id = Buffer.from(swarm.keyPair.publicKey).toString('hex')
} catch {
  id = randomBytes(8).toString('hex')
}

let fixedName = false
function initialName(): string {
  if (Number.isInteger(indexArg) && indexArg !== null && indexArg >= 0) {
    fixedName = true
    return PEAR_NAMES[indexArg % PEAR_NAMES.length]
  }
  if (nameArg) {
    fixedName = true
    return nameArg
  }
  return PEAR_NAMES[0] // provisional; reconciled on collision
}

let myName = initialName()

// ---- live state (module scope; mirrored into the Ink store) ---------------

const remotes = new Map<string, { name: string; joined: Set<string>; socket: unknown }>()
const selfJoined = new Set<string>()
const events: string[] = []
let online = false
let cursor = 0
const expanded = new Set<string>()

// ---- helpers ---------------------------------------------------------------

function timestamp() {
  return new Date().toTimeString().slice(0, 8)
}

function fmtTok(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`
}

// Other pears only — self is never counted here.
function peerCounts(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const { joined } of remotes.values()) {
    for (const p of joined) out[p] = (out[p] ?? 0) + 1
  }
  return out
}

// ---- naming ----------------------------------------------------------------

function freeName(): string {
  const taken = new Set([...remotes.values()].map((r) => r.name))
  for (const n of PEAR_NAMES) {
    if (n !== myName && !taken.has(n)) return n
  }
  let k = 1
  while (taken.has(`${myName}-${k}`)) k++
  return `${myName}-${k}`
}

function rename(next: string) {
  myName = next
  broadcast({ t: 'rename', name: next })
  logEvent(`now known as ${next}`)
}

// An auto-claimed name re-claims the next free name on collision. Deterministic
// tiebreak: the larger public key renames, the smaller one keeps the name.
function reconcileName() {
  if (fixedName) return
  for (const [rid, r] of remotes) {
    if (r.name === myName && id > rid) {
      rename(freeName())
      return
    }
  }
}

// ---- join / leave + gossip -------------------------------------------------

function broadcast(message: Record<string, unknown>) {
  const payload = JSON.stringify(message) + '\n'
  for (const socket of swarm.connections.values()) (socket as { write(s: string): void }).write(payload)
}

function join(problemId: string) {
  if (selfJoined.has(problemId)) return
  selfJoined.add(problemId)
  broadcast({ t: 'join', name: myName, problemId })
  logEvent(`${myName} joined ${problemId}`)
}

function leave(problemId: string) {
  if (!selfJoined.delete(problemId)) return
  broadcast({ t: 'leave', name: myName, problemId })
  logEvent(`${myName} left ${problemId}`)
}

// ---- Ink store -------------------------------------------------------------

interface Snapshot {
  name: string
  online: boolean
  cursor: number
  expanded: string[]
  selfJoined: string[]
  remotes: Record<string, { name: string; joined: string[] }>
  counts: Record<string, number>
  events: string[]
}

function derive(): Snapshot {
  return {
    name: myName,
    online,
    cursor,
    expanded: [...expanded],
    selfJoined: [...selfJoined],
    remotes: Object.fromEntries([...remotes].map(([rid, r]) => [rid, { name: r.name, joined: [...r.joined] }])),
    counts: peerCounts(),
    events: [...events],
  }
}

const useStore = create<{ tick: number; data: Snapshot }>(() => ({ tick: 0, data: derive() }))

function notify() {
  useStore.setState((s) => ({ tick: s.tick + 1, data: derive() }))
}

function logEvent(text: string) {
  events.push(`${timestamp()}  ${text}`)
  if (events.length > 40) events.shift()
  notify()
}

// ---- components ------------------------------------------------------------

function Header({ data }: { data: Snapshot }) {
  const total = Object.keys(data.remotes).length
  return (
    <Box flexDirection="row" justifyContent="space-between">
      <Text>{data.online ? 'online' : 'connecting'} · {total} peers</Text>
      <Text>node: {data.name}</Text>
    </Box>
  )
}

function ProblemRow({ problem, index, data }: { problem: (typeof PROBLEMS)[number]; index: number; data: Snapshot }) {
  const joined = data.selfJoined.includes(problem.id)
  const open = data.expanded.includes(problem.id)
  const peers = data.counts[problem.id] ?? 0
  const peersStr = `${peers} peer${peers === 1 ? '' : 's'}${joined ? ' + you' : ''}`
  const selected = index === data.cursor
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" flexGrow={1}>
        <Text inverse={selected}>{joined ? '●' : '○'} {open ? '▼' : '▸'} </Text>
        <Text inverse={selected} flexGrow={1}>{problem.title}</Text>
        <Text inverse={selected}>{peersStr}  {fmtTok(problem.tokens)} tok</Text>
      </Box>
      {open
        ? problem.subproblems.map((sub, j) => (
            <Text key={j}>      {j === problem.subproblems.length - 1 ? '└' : '├'} {sub.text}</Text>
          ))
        : null}
    </Box>
  )
}

function Feed({ data }: { data: Snapshot }) {
  return (
    <Box flexDirection="column">
      {data.events.slice(-12).map((e, i) => (
        <Text key={`${e}-${i}`} dimColor>{e}</Text>
      ))}
    </Box>
  )
}

function App() {
  const data = useStore((s) => s.data)
  const { exit } = useApp()

  useInput((input, key) => {
    if (key.downArrow || input === 'j') {
      cursor = Math.min(cursor + 1, PROBLEMS.length - 1)
      notify()
    } else if (key.upArrow || input === 'k') {
      cursor = Math.max(cursor - 1, 0)
      notify()
    } else if (key.return) {
      const p = PROBLEMS[cursor]
      if (expanded.has(p.id)) expanded.delete(p.id)
      else expanded.add(p.id)
      notify()
    } else if (input === ' ') {
      const p = PROBLEMS[cursor]
      if (selfJoined.has(p.id)) leave(p.id)
      else join(p.id)
    } else if (input === 'q') {
      exit()
    }
  })

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Header data={data} />
      <Box flexDirection="column" marginTop={1}>
        <Text bold>PROBLEMS</Text>
        {PROBLEMS.map((p, i) => (
          <ProblemRow key={p.id} problem={p} index={i} data={data} />
        ))}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Feed data={data} />
      </Box>
    </Box>
  )
}

// ---- swarm -----------------------------------------------------------------

swarm.on('connection', (socket) => {
  const peerId = socket.remotePublicKey.toString('hex')
  remotes.set(peerId, { name: peerId.slice(0, 8), joined: new Set(), socket })

  socket.write(JSON.stringify({ t: 'hello', name: myName, joined: [...selfJoined] }) + '\n')

  const incoming = readline.createInterface({ input: socket })
  incoming.on('line', (raw) => {
    let msg: { t?: string; name?: string; joined?: string[]; problemId?: string }
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    if (msg.t === 'hello') {
      remotes.set(peerId, { name: msg.name ?? peerId.slice(0, 8), joined: new Set(msg.joined ?? []), socket })
      logEvent(`${msg.name ?? peerId.slice(0, 8)} connected`)
      for (const problemId of msg.joined ?? []) {
        logEvent(`${msg.name ?? peerId.slice(0, 8)} joined ${problemId}`)
      }
      reconcileName()
      notify()
    } else if (msg.t === 'rename') {
      const r = remotes.get(peerId)
      if (r) r.name = msg.name ?? r.name
      logEvent(`${peerId.slice(0, 8)} is now ${msg.name}`)
      reconcileName()
      notify()
    } else if (msg.t === 'join') {
      remotes.get(peerId)?.joined.add(msg.problemId ?? '')
      logEvent(`${msg.name ?? peerId.slice(0, 8)} joined ${msg.problemId}`)
      notify()
    } else if (msg.t === 'leave') {
      remotes.get(peerId)?.joined.delete(msg.problemId ?? '')
      logEvent(`${msg.name ?? peerId.slice(0, 8)} left ${msg.problemId}`)
      notify()
    }
  })

  socket.on('error', () => {})
  socket.on('close', () => {
    const entry = remotes.get(peerId)
    incoming.close()
    // Only drop the entry if this closing socket is still the active one —
    // otherwise a replaced connection would erase the fresh replacement.
    if (entry && entry.socket === socket) {
      remotes.delete(peerId)
      logEvent(`${entry.name} disconnected`)
      reconcileName()
      notify()
    }
  })
})

const discovery = swarm.join(topic, { server: true, client: true })
discovery
  .flushed()
  .then(() => {
    online = true
    logEvent(`${myName} online (room "${ROOM}")`)
    if (autoJoin) join(autoJoin)
    notify()
  })
  .catch((err) => console.error(err))

process.once('SIGINT', () => {
  swarm.destroy().catch(() => {})
})

render(<App />)