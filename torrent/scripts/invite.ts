// Mint an invite: a single-use Headscale pre-auth key for a user, wrapped with
// this pear's public key so the invitee can say who brought it in.
//
//   pnpm invite -- [--user name] [--hours 24] [--home dir]
//
// Needs HEADSCALE_URL and HEADSCALE_API_KEY in torrent/.env.local (see
// README "hosting adiabatic.garden"). --user defaults to your own username, so
// the new device joins your account; pass another name to invite a friend.

import { Headscale } from '../src/headscale.ts'
import { defaultHome, loadIdentity } from '../src/identity.ts'
import { formatInvite } from '../src/invite.ts'
import { flagString, parseFlags } from '../src/room.ts'

const flags = parseFlags(process.argv.slice(2))
const home = flagString(flags, 'home', defaultHome())
const hours = Number(flagString(flags, 'hours', '24'))
const me = loadIdentity(home)
const user = flagString(flags, 'user', me.username ?? '')
const url = process.env.HEADSCALE_URL ?? ''
const apiKey = process.env.HEADSCALE_API_KEY ?? ''

if (!url || !apiKey) {
  console.error('Set HEADSCALE_URL and HEADSCALE_API_KEY in torrent/.env.local (headscale apikeys create).')
  process.exit(1)
}
if (!user) {
  console.error('No username yet: run `pnpm join` first, or pass --user <name>.')
  process.exit(1)
}

const headscale = new Headscale(url, apiKey)
const key = await headscale.createPreAuthKey(await headscale.userId(user), hours)
const host = new URL(url).host
const code = formatInvite({ host, inviter: me.id, key })

console.log(`invite for ${user}, single use, expires in ${hours}h:\n\n  ${code}\n`)
console.log(`on the new device:\n\n  curl -fsSL https://${host}/join | sh -s -- ${code}\n`)
