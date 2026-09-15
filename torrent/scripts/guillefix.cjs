const Hyperswarm = require('hyperswarm')
const { createHash } = require('node:crypto')
const readline = require('node:readline')

const room = process.argv[2]
if (!room) {
  console.error('Usage: node guillefix.cjs <room>')
  process.exit(1)
}

// Convert the shared room name into a 32-byte topic.
const topic = createHash('sha256').update(room).digest()
const swarm = new Hyperswarm()
const peers = new Set()

swarm.on('connection', socket => {
  const id = socket.remotePublicKey.toString('hex').slice(0, 8)
  peers.add(socket)
  console.log(`Peer connected: ${id} (${peers.size} total)`)

  // Read complete lines: network chunks may split messages.
  const incoming = readline.createInterface({ input: socket })
  incoming.on('line', line => {
    // TUI pears prefix their control protocol with U+001F; hide it here.
    if (line.startsWith('\u001f')) return
    console.log(`[${id}] ${line}`)
  })
  incoming.on('error', err => {
    if (err.code !== 'ECONNRESET') console.error(`Reader error: ${err.message}`)
  })

  socket.on('error', err => console.error(`Peer error: ${err.message}`))
  socket.on('close', () => {
    peers.delete(socket)
    incoming.close()
    console.log(`Peer disconnected: ${id}`)
  })
})

const discovery = swarm.join(topic, { server: true, client: true })
discovery.flushed()
  .then(() => console.log('Room announced. Waiting for peers…'))
  .catch(err => console.error(err))

const input = readline.createInterface({ input: process.stdin })
input.on('line', line => {
  if (!peers.size) {
    console.log('No peers connected yet; message was not sent.')
    return
  }
  for (const socket of peers) socket.write(line + '\n')
})

process.once('SIGINT', async () => {
  input.close()
  await swarm.destroy()
  process.exit(0)
})
