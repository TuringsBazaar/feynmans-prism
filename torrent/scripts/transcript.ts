// Transcript logger: sits in a room, records every chat line, and writes a
// markdown snapshot to snapshots/ every 30 s and on exit. Port of
// pear-to-pear/snapshot.cjs with the LLM distillation step removed.
//
//   pnpm transcript -- [--room pears] [--every 30]
//
// Lines typed on stdin are sent into the room as "[scribe] text".

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { DEFAULT_ROOM, flagString, openRoom, parseFlags, peerId, readLines, writeAll } from '../src/room.ts'
import { encodeChat, isControl, parseChat } from '../src/wire.ts'

const flags = parseFlags(process.argv.slice(2))
const room = flagString(flags, 'room', DEFAULT_ROOM)
const everySec = Number(flagString(flags, 'every', '30'))

const snapshotDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'snapshots')
const { swarm, discovery } = openRoom(room)
const transcript: Array<{ at: string; from: string; text: string }> = []
let written = 0
let stopped = false

function record(from: string, text: string) {
  const entry = { at: new Date().toISOString(), from, text }
  transcript.push(entry)
  console.log(`${entry.at.slice(11, 19)}  ${from}: ${text.replace(/\s+/g, ' ').slice(0, 120)}`)
}

function snapshot() {
  if (transcript.length === written) return
  mkdirSync(snapshotDir, { recursive: true })
  const now = new Date()
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const body = transcript.map((e) => `- ${e.at} — **${e.from}**: ${e.text.replace(/\s+/g, ' ')}`).join('\n')
  const contents =
    `# ${room} — transcript\n\n` +
    `- Captured: ${now.toISOString()}\n` +
    `- Messages: ${transcript.length}\n` +
    `- Peers connected now: ${swarm.connections.size}\n\n` +
    `${body}\n`
  const file = join(snapshotDir, `${room}-${stamp}.md`)
  writeFileSync(file, contents)
  writeFileSync(join(snapshotDir, `${room}-latest.md`), contents)
  written = transcript.length
  console.log(`snapshot: ${file}`)
}

swarm.on('connection', (socket) => {
  const id = peerId(socket).slice(0, 8)
  console.log(`peer connected: ${id} (${swarm.connections.size} total)`)
  readLines(socket, (line) => {
    if (isControl(line)) return
    const chat = parseChat(line)
    if (chat) record(chat.from ?? id, chat.text)
  })
  socket.on('close', () => console.log(`peer disconnected: ${id} (${swarm.connections.size} total)`))
})

await discovery.flushed()
console.log(`transcript for room "${room}" → ${snapshotDir} (every ${everySec}s, and on exit)`)

const stdin = createInterface({ input: process.stdin })
stdin.on('line', (line) => {
  if (!line.trim()) return
  if (!swarm.connections.size) return console.log('no peers connected; not sent')
  writeAll(swarm.connections, encodeChat('scribe', line))
  record('scribe', line)
})
stdin.on('error', () => {})

const timer = setInterval(snapshot, everySec * 1000)

async function stop() {
  if (stopped) return
  stopped = true
  clearInterval(timer)
  stdin.close()
  snapshot()
  await swarm.destroy()
  process.exit(0)
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.once(sig, () => void stop())
