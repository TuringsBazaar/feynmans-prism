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

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROBLEMS } from '../src/data.ts'
import { loadApiKey } from '../src/credentials.ts'
import { DEFAULT_ROOM, flagString, parseFlags } from '../src/room.ts'

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const flags = parseFlags(process.argv.slice(2), ['join', 'terminal', 'deepseek'])
const words = flags.positional.filter((w) => Number.isNaN(Number(w)))
const numbers = flags.positional.filter((w) => !Number.isNaN(Number(w)))
const command = words[0] ?? 'start'
const deepseek = flags.opts.deepseek === true
const count = numbers.length ? Number(numbers[0]) : deepseek ? 3 : 5
const room = flagString(flags, 'room', deepseek ? 'manual-pears' : DEFAULT_ROOM)
const join = flags.opts.join === true
const forceTerminal = flags.opts.terminal === true
const session = `${deepseek ? 'deepseek' : 'pears'}-${room}`
let apiKey = ''

function quote(value: string) {
  return "'" + value.replaceAll("'", "'\\''") + "'"
}

function hasTmux() {
  return spawnSync('tmux', ['-V'], { stdio: 'ignore' }).status === 0
}

function exists() {
  return spawnSync('tmux', ['has-session', '-t', `=${session}`], { stdio: 'ignore' }).status === 0
}

function tmux(...args: string[]) {
  const result = spawnSync('tmux', args, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr?.trim() || 'Could not run tmux')
  return result.stdout.trim()
}

function pearCommand(i: number) {
  const parts = [process.execPath, '--env-file-if-exists=.env.local', '--import', 'tsx']
  if (deepseek) {
    parts.push('scripts/agent.ts', i % 2 ? 'gwern' : 'aman', '--name', `pear-${i + 1}`, '--manual')
  } else {
    parts.push('src/pear.tsx')
    if (i === 0) parts.push('--coordinator')
    if (join) parts.push('--auto-join', PROBLEMS[i % PROBLEMS.length].id)
  }
  return 'exec ' + [...parts, '--room', room].map(quote).join(' ')
}

function attach() {
  const reconnect = deepseek ? `just pears-attach ${room}` : `tmux attach -t ${session}`
  if (!exists()) throw new Error(`Room "${room}" is not running. Start it with: just pears 3 ${room}`)
  console.log(`Room "${room}" is running. Attach: ${reconnect}`)
  if (!process.stdin.isTTY || !process.stdout.isTTY) return
  const action = process.env.TMUX ? 'switch-client' : 'attach-session'
  const result = spawnSync('tmux', [action, '-t', `=${session}`], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error('Could not attach to the room')
}

function addPane(i: number) {
  let args: string[]
  if (i === 0) args = ['new-session', '-d', '-s', session, '-x', '220', '-y', '60']
  else if (deepseek && i % 4 === 0) args = ['new-window', '-t', `${session}:`]
  else args = ['split-window', '-t', session]
  if (deepseek) {
    args.push('-e', `OPENROUTER_API_KEY=${apiKey}`)
    args.push('-e', `PEAR_MODEL=${process.env.PEAR_MODEL || 'deepseek/deepseek-v4-pro-0813'}`)
  }
  const pane = tmux(...args, '-P', '-F', '#{pane_id}', '-c', dir, pearCommand(i))
  if (deepseek) tmux('select-pane', '-t', pane, '-T', `pear-${i + 1} · DeepSeek`)
  tmux('select-layout', '-t', session, 'tiled')
}

function reopen() {
  if (!deepseek)
    throw new Error(`Session "${session}" already exists. Attach with: tmux attach -t ${session}`)
  const current = Number(tmux('list-panes', '-s', '-t', session, '-F', '#{pane_id}').split('\n').length)
  if (current !== count)
    throw new Error(`Room has ${current} pears. Resize with: just pears-restart ${count} ${room}`)
  attach()
}

function startTmux() {
  if (exists()) return reopen()
  try {
    for (let i = 0; i < count; i++) {
      // Stagger so the coordinator is announced before the members look for it.
      if (i && !deepseek) spawnSync('sleep', ['0.3'])
      addPane(i)
    }
    if (deepseek) {
      tmux('set-option', '-t', session, 'mouse', 'on')
      tmux('set-option', '-t', session, 'pane-border-status', 'top')
      tmux('set-option', '-t', session, 'pane-border-format', ' #{pane_title} ')
    }
  } catch (error) {
    spawnSync('tmux', ['kill-session', '-t', `=${session}`], { stdio: 'ignore' })
    throw error
  }
  console.log(`Started ${count} ${deepseek ? 'DeepSeek ' : ''}pears in room "${room}".`)
  if (deepseek) console.log('Click a pane, type its problem, and press Enter. Ctrl+B then D detaches.')
  else console.log(`Stop: pnpm orchestrator -- stop --room ${room}`)
  attach()
}

function startTerminal() {
  if (process.platform !== 'darwin') throw new Error('Install tmux to run rooms on this platform.')
  for (let i = 0; i < count; i++) {
    const shell = `cd ${quote(dir)} && ${pearCommand(i)}`
    const script = `tell application "Terminal" to do script ${JSON.stringify(shell)}`
    const r = spawnSync('osascript', ['-e', script], { stdio: 'ignore' })
    if (r.status !== 0) console.error(`failed to open Terminal window ${i + 1}`)
    spawnSync('sleep', ['0.3'])
  }
  console.log(`opened ${count} Terminal windows, one pear each (room "${room}"). Quit each with q.`)
}

function stop() {
  if (exists()) {
    tmux('kill-session', '-t', `=${session}`)
    console.log(`Stopped room "${room}".`)
  } else console.log(`Room "${room}" is not running.`)
}

function validate() {
  if (!['start', 'stop', 'restart', 'attach'].includes(command) || words.length > 1 || numbers.length > 1)
    throw new Error('Usage: orchestrator [start|restart|attach|stop] [N] [--room name] [--deepseek]')
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('Pear count must be a positive integer.')
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(room))
    throw new Error('Room names must use 1–64 letters, numbers, hyphens, or underscores.')
  if (deepseek && (join || forceTerminal)) throw new Error('DeepSeek rooms use tmux and manual assignments.')
  if (deepseek && !hasTmux()) throw new Error('Install tmux to start a DeepSeek room.')
  if (deepseek && ['start', 'restart'].includes(command)) {
    apiKey = loadApiKey()
    if (process.env.PEAR_MODEL && !process.env.PEAR_MODEL.startsWith('deepseek/'))
      throw new Error('PEAR_MODEL must select a deepseek/ model for DeepSeek rooms.')
  }
}

try {
  validate()
  if (command === 'stop') stop()
  else if (command === 'attach') attach()
  else {
    if (command === 'restart') stop()
    if (!forceTerminal && hasTmux()) startTmux()
    else startTerminal()
  }
} catch (error) {
  console.error((error as Error).message)
  process.exitCode = 1
}
