// LLM persona pear: joins a room, reads the chat, replies in character.
// Port of pear-to-pear/deepseek-agent.mjs. Speaks the shared "[Name] text"
// chat format and ignores the pear's control lines.
//
//   pnpm agent -- <persona> [--room pears]
//
// Personas live in ../../PEARS.md. The "stirrer" walks the problem list from
// ../src/data.ts. Requires an OpenRouter key: OPENROUTER_API_KEY, or the key in
// ~/.local/share/opencode/auth.json. Model: PEAR_MODEL (default below).

import { loadApiKey } from '../src/credentials.ts'
import { createInterface } from 'node:readline'
import { PROBLEMS } from '../src/data.ts'
import { DEFAULT_ROOM, flagString, openRoom, parseFlags, peerId, readLines, writeAll } from '../src/room.ts'
import { isControl } from '../src/wire.ts'
import { loadPersonas } from '../src/personas.ts'

const MODEL = process.env.PEAR_MODEL ?? 'deepseek/deepseek-v4-pro-0813'
const MAX_HISTORY = 16
const MIN_REPLY_INTERVAL_MS = 1500

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

// ---- args ------------------------------------------------------------------

const flags = parseFlags(process.argv.slice(2), ['manual'])
const manual = flags.opts.manual === true
const [personaKey, legacyRoom] = flags.positional // legacy: <persona> <room>
const room = flagString(flags, 'room', legacyRoom ?? DEFAULT_ROOM)

const personas = loadPersonas()
const persona = personaKey ? personas[personaKey] : undefined
if (!persona) {
  console.error('Usage: pnpm agent -- <persona> [--room pears]')
  console.error('Available:', Object.keys(personas).join(', '))
  process.exit(1)
}

// ---- API key ---------------------------------------------------------------

const apiKey = loadApiKey()
persona.name = flagString(flags, 'name', persona.name)
if (manual) {
  persona.system +=
    '\nWork only on the problem assigned by the human in this terminal. ' +
    'You have no browsing or execution tools; distinguish proposals from verified results.'
}

// ---- chat plumbing ---------------------------------------------------------

const knownTags = new Set(
  Object.values(personas)
    .filter((p) => !p.stir)
    .map((p) => `[${p.name}]`),
)

function stripTags(text: string) {
  let out = text.trim().replace(/^(\[[^\]]*\]\s*)+/, '')
  for (const t of knownTags) out = out.split(t).join('')
  return out.trim()
}

const pears = openRoom(room)
const history: Message[] = []
let lastReply = 0
let lastActivity = 0

function pushHistory(role: Message['role'], content: string) {
  history.push({ role, content })
  if (history.length > MAX_HISTORY) history.shift()
}

async function ask(messages: Message[]): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost',
      'X-Title': 'feynmans-prism-pears',
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.8 }),
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return (data.choices?.[0]?.message?.content ?? '').trim()
}

function broadcast(text: string) {
  writeAll(pears.connections, text + '\n')
}

function shouldReply(fromTag: string | null): boolean {
  if (persona!.noReply) return false
  if (persona!.replyTo?.length) return fromTag ? persona!.replyTo.includes(fromTag.slice(1, -1)) : false
  return !fromTag
}

async function reply() {
  try {
    const clean = stripTags(await ask([{ role: 'system', content: persona!.system }, ...history]))
    if (!clean) return
    const tagged = `[${persona!.name}] ${clean}`
    pushHistory('assistant', tagged)
    broadcast(tagged)
    console.log(`<${persona!.name}> ${clean}`)
    lastActivity = Date.now()
  } catch (err) {
    console.error(`[${persona!.name}] error:`, (err as Error).message)
  }
}

async function handleLine(raw: string) {
  if (isControl(raw)) return
  const line = raw.trim()
  if (!line) return
  lastActivity = Date.now()

  const fromTag = [...knownTags].find((t) => line.startsWith(t)) ?? null
  pushHistory(fromTag ? 'assistant' : 'user', line)
  if (!shouldReply(fromTag)) return

  const now = Date.now()
  if (now - lastReply < MIN_REPLY_INTERVAL_MS) return
  lastReply = now
  await reply()
}

pears.on('connection', (socket) => {
  console.log(
    `[${persona.name}] peer connected: ${peerId(socket).slice(0, 8)} (${pears.connections.size} total)`,
  )
  readLines(socket, (line) => {
    if (!manual) void handleLine(line)
  })
})

if (manual) {
  let queue = Promise.resolve()
  const input = createInterface({ input: process.stdin, output: process.stdout })
  input.on('line', (line) => {
    if (!line.trim()) return
    queue = queue.then(async () => {
      pushHistory('user', line.trim())
      await reply()
      console.log('[' + persona.name + '] awaiting assignment — type a problem and press Enter')
    })
  })
  console.log('[' + persona.name + '] awaiting assignment — type a problem and press Enter')
}

await pears.ready()
console.log(`[${persona.name}] joined room "${room}" as ${personaKey} (model ${MODEL})`)

// ---- stirrer: walk the problem list when the room goes quiet ---------------

if (persona.stir && !manual) {
  const problems = PROBLEMS.map((p, i) => `PROBLEM ${i + 1}/${PROBLEMS.length} — ${p.statement}`)
  const stirIdle = persona.stirIdleMs ?? 20000
  let idx = 0
  const stir = () => {
    if (Date.now() - lastActivity < stirIdle) return
    const p = problems[idx++ % problems.length]
    const tagged = `[${persona.name}] ${p}`
    pushHistory('user', tagged)
    broadcast(tagged)
    console.log(`<${persona.name}> ${p}`)
    lastActivity = Date.now()
  }
  setTimeout(stir, 3000)
  setInterval(stir, persona.stirEveryMs ?? 30000)
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.once(sig, () => void pears.close().then(() => process.exit(0)))
}
