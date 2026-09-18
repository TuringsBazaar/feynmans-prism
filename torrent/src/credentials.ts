import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function loadApiKey(): string {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY
  try {
    const auth = JSON.parse(readFileSync(join(homedir(), '.local/share/opencode/auth.json'), 'utf8'))
    if (typeof auth.openrouter?.key === 'string' && auth.openrouter.key) return auth.openrouter.key
  } catch {
    // A missing or invalid saved login can be replaced by an environment key.
  }
  throw new Error('No OpenRouter key. Set OPENROUTER_API_KEY in torrent/.env.local or log in with opencode.')
}
