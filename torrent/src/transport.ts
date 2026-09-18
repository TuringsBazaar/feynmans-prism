// Where pears live and how to reach them. Two transports:
//
//   local      loopback only: every pear on this machine, no network needed
//   tailscale  every online device on the tailnet (WireGuard, relayed through
//              DERP when holepunching fails) plus loopback
//
// A pear listens on the first free port of PORTS, so dialing every port of
// every reachable host finds every pear. No DHT, no announcements to go stale.

import { execFile } from 'node:child_process'
import { connect, createServer, type Server, type Socket } from 'node:net'
import { promisify } from 'node:util'

export type Transport = 'local' | 'tailscale'

export const PORTS: [number, number] = [7100, 7109]
const DIAL_TIMEOUT_MS = 1500
const run = promisify(execFile)

interface TailscaleStatus {
  BackendState: string
  Peer?: Record<string, { Online?: boolean; TailscaleIPs?: string[] }>
}

async function tailscaleStatus(): Promise<TailscaleStatus | null> {
  try {
    const { stdout } = await run('tailscale', ['status', '--json'])
    const status: TailscaleStatus = JSON.parse(stdout)
    return status.BackendState === 'Running' ? status : null
  } catch {
    return null
  }
}

export async function detectTransport(): Promise<Transport> {
  return (await tailscaleStatus()) ? 'tailscale' : 'local'
}

export async function discoverHosts(transport: Transport): Promise<string[]> {
  const hosts = ['127.0.0.1']
  if (transport === 'local') return hosts
  const status = await tailscaleStatus()
  for (const peer of Object.values(status?.Peer ?? {})) {
    if (peer.Online && peer.TailscaleIPs?.[0]) hosts.push(peer.TailscaleIPs[0])
  }
  return hosts
}

// Loopback and Tailscale's own ranges (CGNAT 100.64/10, ULA fd7a:115c:a1e0::/48).
// The listener binds all interfaces in tailscale mode, so this is the gate.
export function isTrustedAddress(address: string | undefined): boolean {
  if (!address) return false
  const a = address.replace(/^::ffff:/i, '').toLowerCase()
  if (a === '127.0.0.1' || a === '::1') return true
  const cgnat = /^100\.(\d+)\.\d+\.\d+$/.exec(a)
  if (cgnat) return Number(cgnat[1]) >= 64 && Number(cgnat[1]) <= 127
  return a.startsWith('fd7a:115c:a1e0:')
}

export const normalizeAddress = (address: string | undefined) => (address ?? '').replace(/^::ffff:/i, '')

export function listen(
  host: string,
  [lo, hi]: [number, number],
  port = lo,
): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && port < hi) resolve(listen(host, [lo, hi], port + 1))
      else reject(err)
    })
    server.listen(port, host, () => resolve({ server, port }))
  })
}

// Resolves null on refusal or timeout; a closed port is the normal case.
export function dial(host: string, port: number): Promise<Socket | null> {
  return new Promise((resolve) => {
    const socket = connect({ host, port })
    const timer = setTimeout(() => socket.destroy(), DIAL_TIMEOUT_MS)
    socket.once('connect', () => {
      clearTimeout(timer)
      resolve(socket)
    })
    socket.on('error', () => {})
    socket.once('close', () => {
      clearTimeout(timer)
      resolve(null)
    })
  })
}
