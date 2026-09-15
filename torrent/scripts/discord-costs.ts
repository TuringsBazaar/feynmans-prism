import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const day = process.argv.slice(2).find((arg) => arg !== '--') ?? new Date().toISOString().slice(0, 10)
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Usage: pnpm discord:costs [YYYY-MM-DD] (UTC)')
const file = fileURLToPath(new URL(`../snapshots/discord/${day}.jsonl`, import.meta.url))
const events = existsSync(file)
  ? readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  : []
const usage = events.filter((event) => event.kind === 'usage')
const cost = usage.reduce((sum, event) => sum + (event.cost ?? 0), 0)
const tokens = usage.reduce((sum, event) => sum + (event.tokens ?? 0), 0)
const unknown = usage.filter((event) => event.cost === null).length
console.log(
  `${day} UTC · ${usage.length} responses · ${tokens} reported tokens · $${cost.toFixed(6)} reported`,
)
if (unknown) console.log(`${unknown} responses had no reported cost.`)
console.log('Cancelled or failed requests may have provider charges absent from this local ledger.')
