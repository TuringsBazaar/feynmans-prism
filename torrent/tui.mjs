// torch: a thin terminal wireframe for the feynmans pear swarm.
//
// Each process is one pear. It joins the shared hyperswarm "pears" room,
// gossips which problems it has joined, and renders a box-drawn wireframe.
// "Who joined what" streams below the wireframe as it happens.
//
// Names are unique and ordered: the first five pears take the initial names
// (aman…lucy), later pears take the subsequent list (aayush…gwern). Spawn with
// `--index n` for a deterministic name, or pass `--name x`. An auto-claimed
// name re-claims the next free name if it collides with another pear.
//
//   node tui.mjs pears              # room + auto-claimed name
//   node tui.mjs pears --index 3    # PEAR_NAMES[3]
//   node tui.mjs pears --name aman --auto-join credit-assignment
//
// Keys: [j/k] or [up/down] move · [space] join/pause · [enter] expand · [q] quit

import Hyperswarm from 'hyperswarm'
import { createHash, randomBytes } from 'node:crypto'
import readline from 'node:readline'
import { PEAR_NAMES, PROBLEMS } from './data.mjs'

const W = 76

// ---- args ------------------------------------------------------------------

const args = process.argv.slice(2)
const ROOM = args[0] && !args[0].startsWith('--') ? args[0] : 'pears'

let nameArg = null
let autoJoin = null
let indexArg = null
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

let id
try {
  id = Buffer.from(swarm.keyPair.publicKey).toString('hex')
} catch {
  id = randomBytes(8).toString('hex')
}

let fixedName = false
function initialName() {
  if (Number.isInteger(indexArg) && indexArg >= 0) {
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

// ---- state -----------------------------------------------------------------

// remotes: Map<publicKeyHex, { name, joined:Set<problemId>, socket }>
const remotes = new Map()
const selfJoined = new Set()

let online = false
let cursor = 0
const expanded = new Set()
const events = [] // ring buffer of one-line log strings

// ---- helpers ---------------------------------------------------------------

function timestamp() {
  return new Date().toTimeString().slice(0, 8)
}

function pad(s, w) {
  return s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length)
}

function right(s, w) {
  return s.length >= w ? s.slice(0, w) : ' '.repeat(w - s.length) + s
}

function fmtTok(n) {
  if (n === null || n === undefined) return '—'
  return n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`
}

// Other pears only — self is never counted here.
function peerCounts() {
  const out = {}
  for (const { joined } of remotes.values()) {
    for (const p of joined) out[p] = (out[p] ?? 0) + 1
  }
  return out
}

// ---- naming ----------------------------------------------------------------

function freeName() {
  const taken = new Set([...remotes.values()].map((r) => r.name))
  for (const n of PEAR_NAMES) {
    if (n !== myName && !taken.has(n)) return n
  }
  let k = 1
  while (taken.has(`${myName}-${k}`)) k++
  return `${myName}-${k}`
}

function rename(next) {
  myName = next
  broadcast({ t: 'rename', name: next })
  logEvent(`now known as ${next}`)
}

// A pear with an auto-claimed name re-claims the next free name when a remote
// holds the same name. Deterministic tiebreak: the larger public key renames.
function reconcileName() {
  if (fixedName) return
  for (const [rid, r] of remotes) {
    if (r.name === myName && id > rid) {
      rename(freeName())
      return
    }
  }
}

// ---- wireframe -------------------------------------------------------------

const rule = (c) => c.repeat(W)
const boxTop = `┌${rule('─')}┐`
const boxMid = `├${rule('─')}┤`
const boxBot = `└${rule('─')}┘`
const line = (s) => `│${pad(s, W)}│`

function problemContent(p) {
  const joinedSelf = selfJoined.has(p.id)
  const open = expanded.has(p.id)
  const dot = joinedSelf ? '●' : '○'
  const tri = open ? '▼' : '▸'
  const peers = peerCounts()[p.id] ?? 0
  let peersStr = `${peers} peer${peers === 1 ? '' : 's'}`
  if (joinedSelf) peersStr += ' + you'
  const tokStr = `${fmtTok(p.tokens)} tok`

  const titleW = 40
  const titleCell = pad(p.title, titleW)
  const rightCell = `${peersStr}  ${tokStr}`
  const rightPart = right(rightCell, W - 5 - titleW)
  return pad(`${dot} ${tri} ${titleCell}${rightPart}`, W)
}

function subproblemContent(sub, last) {
  const branch = last ? '└' : '├'
  return `      ${branch} ${sub.text}`
}

function buildFrame() {
  const status = online ? 'online' : 'connecting'

  const out = []
  out.push(boxTop)

  const leftHead = ` ${status} · ${remotes.size} peers`
  out.push(line(leftHead + right(`node: ${myName}`, W - leftHead.length)))

  out.push(boxMid)
  out.push(line(' PROBLEMS'))
  out.push(line(''))

  PROBLEMS.forEach((p, i) => {
    const inner = problemContent(p)
    out.push(`│${i === cursor ? `\x1b[7m${inner}\x1b[0m` : inner}│`)
    if (expanded.has(p.id)) {
      p.subproblems.forEach((sub, j) => {
        out.push(line(subproblemContent(sub, j === p.subproblems.length - 1)))
      })
    }
    out.push(line(''))
  })

  out.push(boxBot)

  // "who joined what" — the live terminal feed, below the wireframe.
  out.push('')
  out.push(...events.slice(-12))

  return out.join('\n')
}

function render() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[2J\x1b[H' + buildFrame() + '\n')
  }
}

// ---- events ----------------------------------------------------------------

function logEvent(text) {
  const entry = ` ${timestamp()}  ${text}`
  events.push(entry)
  if (events.length > 40) events.shift()
  if (process.stdout.isTTY) render()
  else console.log(entry)
}

// ---- join / leave ----------------------------------------------------------

function broadcast(message) {
  const payload = JSON.stringify(message) + '\n'
  for (const socket of swarm.connections.values()) socket.write(payload)
}

function join(problemId) {
  if (selfJoined.has(problemId)) return
  selfJoined.add(problemId)
  broadcast({ t: 'join', name: myName, problemId })
  logEvent(`${myName} joined ${problemId}`)
  render()
}

function leave(problemId) {
  if (!selfJoined.delete(problemId)) return
  broadcast({ t: 'leave', name: myName, problemId })
  logEvent(`${myName} left ${problemId}`)
  render()
}

// ---- keyboard --------------------------------------------------------------

function setupKeyboard() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') return
  process.stdin.setRawMode(true)
  process.stdin.setEncoding('utf8')
  process.stdin.resume()
  process.stdin.on('data', (key) => {
    if (key === '\u0003' || key === 'q') {
      cleanup()
      process.exit(0)
    } else if (key === 'j' || key === '\u001b[B') {
      cursor = Math.min(cursor + 1, PROBLEMS.length - 1)
      render()
    } else if (key === 'k' || key === '\u001b[A') {
      cursor = Math.max(cursor - 1, 0)
      render()
    } else if (key === ' ') {
      const p = PROBLEMS[cursor]
      if (selfJoined.has(p.id)) leave(p.id)
      else join(p.id)
    } else if (key === '\r' || key === '\n') {
      const idp = PROBLEMS[cursor].id
      if (expanded.has(idp)) expanded.delete(idp)
      else expanded.add(idp)
      render()
    }
  })
}

// ---- swarm -----------------------------------------------------------------

swarm.on('connection', (socket) => {
  const peerId = socket.remotePublicKey.toString('hex')
  remotes.set(peerId, { name: peerId.slice(0, 8), joined: new Set(), socket })

  socket.write(JSON.stringify({ t: 'hello', name: myName, joined: [...selfJoined] }) + '\n')

  const incoming = readline.createInterface({ input: socket })
  incoming.on('line', (raw) => {
    let msg
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
      render()
    } else if (msg.t === 'rename') {
      const r = remotes.get(peerId)
      if (r) r.name = msg.name
      logEvent(`${peerId.slice(0, 8)} is now ${msg.name}`)
      reconcileName()
      render()
    } else if (msg.t === 'join') {
      remotes.get(peerId)?.joined.add(msg.problemId)
      logEvent(`${msg.name ?? peerId.slice(0, 8)} joined ${msg.problemId}`)
      render()
    } else if (msg.t === 'leave') {
      remotes.get(peerId)?.joined.delete(msg.problemId)
      logEvent(`${msg.name ?? peerId.slice(0, 8)} left ${msg.problemId}`)
      render()
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
      render()
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
    if (!process.stdout.isTTY) console.log(buildFrame())
    render()
  })
  .catch((err) => console.error(err))

function cleanup() {
  try {
    if (process.stdin.isTTY) process.stdin.setRawMode(false)
  } catch {}
  swarm.destroy().catch(() => {})
}

process.once('SIGINT', () => {
  cleanup()
  process.exit(0)
})

setupKeyboard()
render()