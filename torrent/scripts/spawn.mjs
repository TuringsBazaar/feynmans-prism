// Open N terminal windows, each running one named pear in the "pears" room.
// macOS-only convenience for "spawn 5 instances". Usage: node scripts/spawn.mjs [N]

import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const count = Number(process.argv[2] ?? 5)

for (let i = 0; i < count; i++) {
  const command = `cd ${dir} && node tui.mjs pears --index ${i}`
  try {
    execSync(`osascript -e 'tell application "Terminal" to do script "${command}"'`, { stdio: 'ignore' })
  } catch (err) {
    console.error(`failed to open terminal ${i + 1}:`, err.message)
  }
}

console.log(`spawned ${count} pear terminal windows in the "pears" room`)