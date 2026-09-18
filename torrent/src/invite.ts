// Invite codes. One string carries everything a new device needs: which
// Headscale to log into, who invited it (so the inviter can be credited once
// receipts exist), and a single-use pre-auth key.
//
//   feynman:<host>:<inviter public key hex>:<pre-auth key>

export interface Invite {
  host: string
  inviter: string
  key: string
}

const HOST = /^[a-z0-9.-]+(:\d+)?$/i

export const loginServer = (host: string) => `https://${host}`

export function formatInvite(invite: Invite): string {
  return `feynman:${invite.host}:${invite.inviter}:${invite.key}`
}

export function parseInvite(code: string): Invite | null {
  const parts = code.trim().split(':')
  if (parts.length !== 4 || parts[0] !== 'feynman') return null
  const [, host, inviter, key] = parts
  if (!HOST.test(host) || !/^[0-9a-f]{64}$/.test(inviter) || !key) return null
  return { host, inviter, key }
}
