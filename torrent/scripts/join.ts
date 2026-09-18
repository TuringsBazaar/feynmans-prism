// One-time setup; what `curl -fsSL https://adiabatic.garden/join | sh` ends in.
//
//   pnpm join -- [--invite feynman:host:inviter:key] [--home dir] [--room r] [--no-launch]
//
// 1. With an invite: log this machine into the tailnet with the pre-auth key
//    (`tailscale up`), unless it is already on one.
// 2. Ask for a username (default: the tailnet login name, else the OS user)
//    and save it, with the inviter, next to the keypair in identity.json.
// 3. Launch the pear.

import { execFile, spawn, spawnSync } from 'node:child_process'
import { userInfo } from 'node:os'
import { dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { defaultHome, loadIdentity, saveIdentity } from '../src/identity.ts'
import { loginServer, parseInvite, type Invite } from '../src/invite.ts'
import { DEFAULT_ROOM, flagString, parseFlags } from '../src/room.ts'

const run = promisify(execFile)
const torrentDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const flags = parseFlags(process.argv.slice(2), ['no-launch'])
const home = flagString(flags, 'home', defaultHome())
const room = flagString(flags, 'room', DEFAULT_ROOM)

interface Tailnet {
  loginName: string | null
  name: string | null
}

async function tailnet(): Promise<Tailnet | null> {
  try {
    const { stdout } = await run('tailscale', ['status', '--json'])
    const s = JSON.parse(stdout)
    if (s.BackendState !== 'Running') return null
    const loginName: string | null = s.User?.[s.Self?.UserID]?.LoginName ?? null
    return { loginName, name: s.CurrentTailnet?.Name ?? null }
  } catch {
    return null
  }
}

function hasTailscale() {
  return spawnSync('tailscale', ['version'], { stdio: 'ignore' }).status === 0
}

// `tailscale up` needs root on Linux; sudo prompts on the inherited terminal.
function tailscaleUp(invite: Invite) {
  const args = ['tailscale', 'up', '--login-server', loginServer(invite.host), '--authkey', invite.key]
  if (process.platform === 'linux' && process.getuid?.() !== 0) args.unshift('sudo')
  const r = spawnSync(args[0], args.slice(1), { stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`tailscale up failed (exit ${r.status})`)
}

// Headscale logins are plain names; Tailscale ones are emails, or a device's
// own ….ts.net name when it is tagged, which is no username at all.
function defaultUsername(net: Tailnet | null) {
  const login = net?.loginName ?? ''
  if (login.includes('@')) return login.split('@')[0]
  if (login && !login.includes('.')) return login
  return userInfo().username
}

async function ask(question: string, fallback: string) {
  if (!process.stdin.isTTY) return fallback
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question(`${question} [${fallback}]: `)).trim()
  rl.close()
  return answer || fallback
}

async function main() {
  console.log("\nFeynman's Prism.\n")
  const invite = flags.opts.invite ? parseInvite(String(flags.opts.invite)) : null
  if (flags.opts.invite && !invite) throw new Error('invite code not understood')

  let net = await tailnet()
  if (invite && !net) {
    if (!hasTailscale())
      throw new Error('install Tailscale first: curl -fsSL https://tailscale.com/install.sh | sh')
    tailscaleUp(invite)
    net = await tailnet()
  }
  console.log(
    net ? `tailnet: ${net.name ?? 'connected'}` : 'no tailnet: pears on this machine only (--local)',
  )

  const me = loadIdentity(home)
  const username = await ask('username', me.username ?? defaultUsername(net))
  const saved = saveIdentity(home, { username, invitedBy: invite?.inviter ?? me.invitedBy ?? undefined })
  console.log(`you: ${saved.username} · device: ${saved.device} · key: ${saved.id.slice(0, 8)} · ${home}\n`)

  if (flags.opts['no-launch']) return
  const args = ['--import', 'tsx', 'src/pear.tsx', '--home', home, '--room', room]
  spawn(process.execPath, args, { cwd: torrentDir, stdio: 'inherit' }).on('exit', (code) =>
    process.exit(code ?? 0),
  )
}

main().catch((err: Error) => {
  console.error(err.message)
  process.exit(1)
})
