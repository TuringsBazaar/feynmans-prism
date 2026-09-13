// pear sidecar: bridges the browser UI to the shared hyperswarm "pears" room.
// Modeled on guillefix.cjs from exanova-y/pear-to-pear.
//
//   node server/pear.cjs pears           # default ws port 8787
//   PEAR_WS_PORT=9000 node server/pear.cjs pears
//
// Protocol (newline-delimited JSON over the room):
//   hello  { t: 'hello', selfJoined: [problemId, ...] }   on connect
//   join   { t: 'join',  problemId }                        broadcast on toggle
//   leave  { t: 'leave', problemId }                        broadcast on toggle
//
// Browser bridge (ws://127.0.0.1:<port>):
//   in:  { t: 'join', problemId } | { t: 'leave', problemId }
//   out: { t: 'state', room, self, remotes, selfJoined, counts }

const Hyperswarm = require('hyperswarm')
const { WebSocketServer, WebSocket } = require('ws')
const { createHash, randomBytes } = require('node:crypto')
const readline = require('node:readline')

const ROOM = process.argv[2] ?? 'pears'
const WS_PORT = Number(process.env.PEAR_WS_PORT ?? process.argv[3] ?? 8787)

const topic = createHash('sha256').update(ROOM).digest()
const swarm = new Hyperswarm()

let selfKey
try {
  selfKey = Buffer.from(swarm.keyPair.publicKey).toString('hex').slice(0, 8)
} catch {
  selfKey = randomBytes(4).toString('hex')
}

// remotes: Map<shortKey, Set<problemId>> — other pears' joined problems.
const remotes = new Map()
const selfJoined = new Set()

function counts() {
  const out = {}
  for (const joined of remotes.values()) {
    for (const problemId of joined) out[problemId] = (out[problemId] ?? 0) + 1
  }
  return out
}

function broadcast(message) {
  const line = JSON.stringify(message) + '\n'
  for (const socket of swarm.connections.values()) socket.write(line)
}

function join(problemId) {
  if (selfJoined.has(problemId)) return
  selfJoined.add(problemId)
  broadcast({ t: 'join', problemId })
  pushState()
}

function leave(problemId) {
  if (!selfJoined.delete(problemId)) return
  broadcast({ t: 'leave', problemId })
  pushState()
}

// Browser bridge.
const wss = new WebSocketServer({ host: '127.0.0.1', port: WS_PORT })
const clients = new Set()

function stateMessage() {
  return JSON.stringify({
    t: 'state',
    room: ROOM,
    self: selfKey,
    remotes: [...remotes.keys()],
    selfJoined: [...selfJoined],
    counts: counts(),
  })
}

function pushState() {
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(stateMessage())
  }
}

wss.on('connection', (ws) => {
  clients.add(ws)
  ws.send(stateMessage())

  ws.on('message', (data) => {
    let msg
    try {
      msg = JSON.parse(data.toString())
    } catch {
      return
    }
    if (msg.t === 'join') join(msg.problemId)
    else if (msg.t === 'leave') leave(msg.problemId)
  })

  ws.on('close', () => {
    clients.delete(ws)
    for (const problemId of [...selfJoined]) leave(problemId)
  })

  ws.on('error', () => {})
})

swarm.on('connection', (socket) => {
  const key = socket.remotePublicKey.toString('hex').slice(0, 8)
  remotes.set(key, new Set())

  socket.write(JSON.stringify({ t: 'hello', selfJoined: [...selfJoined] }) + '\n')

  const incoming = readline.createInterface({ input: socket })
  incoming.on('line', (line) => {
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }
    if (msg.t === 'hello') {
      const joined = new Set(msg.selfJoined ?? [])
      remotes.set(key, joined)
      pushState()
    } else if (msg.t === 'join') {
      remotes.get(key)?.add(msg.problemId)
      pushState()
    } else if (msg.t === 'leave') {
      remotes.get(key)?.delete(msg.problemId)
      pushState()
    }
  })

  socket.on('error', (err) => {
    if (err.code !== 'ECONNRESET') console.error(err.message)
  })
  socket.on('close', () => {
    remotes.delete(key)
    incoming.close()
    pushState()
  })
})

const discovery = swarm.join(topic, { server: true, client: true })
discovery
  .flushed()
  .then(() => console.log(`room "${ROOM}" announced; ws on 127.0.0.1:${WS_PORT}`))
  .catch((err) => console.error(err))

process.once('SIGINT', async () => {
  wss.close()
  await swarm.destroy()
  process.exit(0)
})