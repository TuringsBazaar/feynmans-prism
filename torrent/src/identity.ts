// Persistent identity: one ed25519 keypair and one device name per pear home,
// created on first run and reused forever after. The public key is the pear's
// id on the wire and, later, the key that signs contribution receipts. Node's
// crypto speaks ed25519 natively; the two DER prefixes wrap raw 32-byte keys.

import {
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign as edSign,
  verify as edVerify,
  type KeyObject,
} from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DEVICE_NAMES } from './data.ts'

const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

export interface Identity {
  id: string // public key, hex
  publicKey: Buffer
  privateKey: KeyObject
  device: string
  username: string | null // set by `pnpm join`; the Headscale user is the account
  invitedBy: string | null // inviter's public key, from the invite code
}

export interface IdentityFile {
  seed: string
  device?: string
  username?: string
  invitedBy?: string
  createdAt?: string
}

export const defaultHome = () => process.env.FEYNMAN_HOME ?? join(homedir(), '.feynman')
const fileIn = (home: string) => join(home, 'identity.json')

export function identityFromSeed(seed: Buffer, file: Partial<IdentityFile> = {}): Identity {
  const privateKey = createPrivateKey({
    key: Buffer.concat([PKCS8_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8',
  })
  const publicKey = createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).subarray(-32)
  return {
    id: publicKey.toString('hex'),
    publicKey,
    privateKey,
    device: file.device ?? 'ephemeral',
    username: file.username ?? null,
    invitedBy: file.invitedBy ?? null,
  }
}

export const ephemeralIdentity = () => identityFromSeed(randomBytes(32))

// A random free device name; suffixed once all nineteen are in use.
export function pickDeviceName(taken: Iterable<string>, rand = Math.random): string {
  const used = new Set(taken)
  const free = DEVICE_NAMES.filter((n) => !used.has(n))
  if (free.length) return free[Math.floor(rand() * free.length)]
  const base = DEVICE_NAMES[Math.floor(rand() * DEVICE_NAMES.length)]
  let k = 2
  while (used.has(`${base}-${k}`)) k++
  return `${base}-${k}`
}

// A corrupt file throws rather than being silently replaced: overwriting it
// would discard the key that every receipt the pear ever earned is bound to.
function readIdentityFile(file: string): IdentityFile {
  const data: IdentityFile = JSON.parse(readFileSync(file, 'utf8'))
  if (typeof data.seed !== 'string' || data.seed.length !== 64)
    throw new Error(`${file}: expected a 32-byte hex seed`)
  return data
}

function writeIdentityFile(home: string, data: IdentityFile) {
  mkdirSync(home, { recursive: true })
  writeFileSync(fileIn(home), JSON.stringify(data) + '\n', { mode: 0o600 })
}

export function loadIdentity(home = defaultHome()): Identity {
  const file = fileIn(home)
  const data: IdentityFile = existsSync(file)
    ? readIdentityFile(file)
    : { seed: randomBytes(32).toString('hex'), createdAt: new Date().toISOString() }
  if (!data.device) {
    data.device = pickDeviceName([])
    writeIdentityFile(home, data)
  }
  return identityFromSeed(Buffer.from(data.seed, 'hex'), data)
}

export function saveIdentity(home: string, patch: Partial<IdentityFile>): Identity {
  const data = { ...readIdentityFile(fileIn(home)), ...patch }
  writeIdentityFile(home, data)
  return identityFromSeed(Buffer.from(data.seed, 'hex'), data)
}

export function sign(identity: Identity, message: string | Buffer): Buffer {
  return edSign(null, Buffer.from(message), identity.privateKey)
}

export function verify(publicKeyHex: string, message: string | Buffer, signature: Buffer): boolean {
  try {
    const raw = Buffer.from(publicKeyHex, 'hex')
    const key = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: 'der', type: 'spki' })
    return edVerify(null, Buffer.from(message), key, signature)
  } catch {
    return false
  }
}
