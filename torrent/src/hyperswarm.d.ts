// Minimal typing for hyperswarm (ships no types). Only the surface we use.
declare module 'hyperswarm' {
  import type { Duplex } from 'node:stream'

  export interface PeerSocket extends Duplex {
    remotePublicKey: Buffer
  }

  export interface Discovery {
    flushed(): Promise<void>
    refresh(): Promise<void>
  }

  export default class Hyperswarm {
    keyPair: { publicKey: Buffer }
    connections: Set<PeerSocket>
    on(event: 'connection', fn: (socket: PeerSocket) => void): this
    join(topic: Buffer, opts?: { server?: boolean; client?: boolean }): Discovery
    destroy(): Promise<void>
  }
}
