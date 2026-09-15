// Orchestrator: launch and stop a room full of pears.
//
//   pnpm orchestrator -- start [N=5] [--room pears] [--join] [--terminal]
//   pnpm orchestrator -- stop  [--room pears]
//
// start  opens N interactive pears. Pear #0 gets --coordinator so the room has
//        a name authority from t=0; the rest ask it for names. --join gives
//        each pear a different problem via --auto-join (round-robin).
//        Default: one tmux session named after the room, tiled panes.
//        --terminal (or no tmux installed): one macOS Terminal window each.
// stop   kills the tmux session. Each pear receives SIGHUP, destroys its swarm
//        and un-announces, so no ghost pears are left on the DHT.

import { execFileSync, spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROBLEMS } from '../src/data.ts'
import { DEFAULT_ROOM, flagString, parseFlags } from '../src/room.ts'

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const flags = parseFlags(process.argv.slice(2), ['join', 'terminal'])
const words = flags.positional.filter((w) => Number.isNaN(Number(w)))
const numbers = flags.positional.filter((w) => !Number.isNaN(Number(w)))
const command = words[0] ?? 'start'
const count = numbers.length ? Number(numbers[0]) : 5
const room = flagString(flags, 'room', DEFAULT_ROOM)
const join = flags.opts.join === true
const forceTerminal = flags.opts.terminal === true
const session = `pears-${room}`

function hasTmux() {
  return spawnSync('tmux', ['-V'], { stdio: 'ignore' }).status === 0
}

function tmux(...args: string[]) {
  return execFileSync('tmux', args, { stdio: ['ignore', 'pipe', 'inherit'] })
    .toString()
    .trim()
}

function pearCommand(i: number) {
  const parts = ['pnpm', 'pear', '--', '--room', room]
  if (i === 0) parts.push('--coordinator')
  if (join) parts.push('--auto-join', PROBLEMS[i % PROBLEMS.length].id)
  return parts.join(' ')
}

function startTmux() {
  if (spawnSync('tmux', ['has-session', '-t', session], { stdio: 'ignore' }).status === 0) {
    console.error(
      `tmux session "${session}" already exists — run \`stop\` first, or \`tmux attach -t ${session}\``,
    )
    process.exit(1)
  }
  tmux('new-session', '-d', '-s', session, '-c', dir, '-x', '220', '-y', '60', pearCommand(0))
  for (let i = 1; i < count; i++) {
    // Stagger so the coordinator is announced before the members look for it.
    spawnSync('sleep', ['0.3'])
    tmux('split-window', '-t', session, '-c', dir, pearCommand(i))
    tmux('select-layout', '-t', session, 'tiled')
  }
  console.log(`started ${count} pears in tmux session "${session}" (room "${room}")`)
  console.log(`  attach:  tmux attach -t ${session}`)
  console.log(`  stop:    pnpm orchestrator -- stop --room ${room}`)
  if (process.stdout.isTTY) {
    const r = spawnSync('tmux', ['attach', '-t', session], { stdio: 'inherit' })
    process.exit(r.status ?? 0)
  }
}

function startTerminal() {
  if (process.platform !== 'darwin') {
    console.error('no tmux found and --terminal fallback is macOS-only. Install tmux: brew install tmux')
    process.exit(1)
  }
  for (let i = 0; i < count; i++) {
    const shell = `cd ${JSON.stringify(dir)} && ${pearCommand(i)}`
    const script = `tell application "Terminal" to do script ${JSON.stringify(shell)}`
    const r = spawnSync('osascript', ['-e', script], { stdio: 'ignore' })
    if (r.status !== 0) console.error(`failed to open Terminal window ${i + 1}`)
    spawnSync('sleep', ['0.3'])
  }
  console.log(`opened ${count} Terminal windows, one pear each (room "${room}"). Quit each with q.`)
}

function stop() {
  const r = spawnSync('tmux', ['kill-session', '-t', session], { stdio: 'ignore' })
  if (r.status === 0) console.log(`stopped tmux session "${session}"`)
  else console.log(`no tmux session "${session}". Stray pears? try: pkill -f pear.tsx`)
}

if (command === 'stop') stop()
else if (command === 'start') {
  if (!forceTerminal && hasTmux()) startTmux()
  else {
    if (!forceTerminal) console.log('tmux not found (brew install tmux) — falling back to Terminal windows')
    startTerminal()
  }
} else {
  console.error(
    `unknown command "${command}". Usage: orchestrator [start|stop] [N] [--room r] [--join] [--terminal]`,
  )
  process.exit(1)
}
