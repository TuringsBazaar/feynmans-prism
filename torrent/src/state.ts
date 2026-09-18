// Live state of this pear. Module-scope mutable objects (not React state) so
// that the protocol modules — which run on socket events, outside React — can
// update it directly; `notify()` mirrors a snapshot into the Ink store.
//
// Everything that varies is a field on `self`, `ui`, `remotes` or `feed`.

import { create } from 'zustand'
import type { PeerSocket } from './room.ts'
import type { CoordinatorLedger, PeerMetrics } from './fragments.ts'
import { initLedger } from './fragments.ts'

export interface Remote {
  name: string | null
  joined: Set<string>
  socket: PeerSocket
  coordinator: boolean
  hello: boolean // has it spoken our control protocol at all?
  since: number
}

export interface FeedEntry {
  kind: 'event' | 'chat'
  text: string
}

// Identity and role of this process.
export const self = {
  id: '', // public key hex, set by pear.tsx once the room is open
  home: '', // identity directory; the device name is persisted there
  since: Date.now(), // coordinator election: earlier start wins
  name: '', // device name from identity.json, or --name/--index
  fixedName: false, // --name/--index given; never yield it in a collision
  coordinator: false,
  coordinatorId: null as string | null, // peerId of the coordinator, if not us
  online: false,
  joined: new Set<string>(),
}

export const remotes = new Map<string, Remote>()
export const feed: FeedEntry[] = []
const FEED_MAX = 60

// Coordinator ledger: only populated if self.coordinator is true.
export let coordinatorLedger: CoordinatorLedger | null = null

export function initCoordinatorLedger(problemId: string) {
  coordinatorLedger = initLedger(problemId)
}

// Terminal cursor and composer; only the UI writes these.
export const ui = {
  cursor: 0,
  expanded: new Set<string>(),
  composing: false,
  draft: '',
}

export const shortId = (id: string) => id.slice(0, 8)
export const label = () => {
  const hash = shortId(self.id)
  return self.name ? `${hash} [${self.name}]` : hash
}
export const remoteLabel = (rid: string) => {
  const hash = shortId(rid)
  const name = remotes.get(rid)?.name
  return name ? `${hash} [${name}]` : hash
}

// Other pears only — self is never counted here.
export function peerCounts(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const { joined } of remotes.values()) {
    for (const p of joined) out[p] = (out[p] ?? 0) + 1
  }
  return out
}

// ---- snapshot for the UI ---------------------------------------------------

export interface Snapshot {
  name: string
  coordinator: boolean
  coordinatorName: string | null
  online: boolean
  cursor: number
  expanded: string[]
  selfJoined: string[]
  remotes: Record<
    string,
    { name: string | null; joined: string[]; solveVelocity?: number; avgAmplification?: number }
  >
  counts: Record<string, number>
  feed: FeedEntry[]
  composing: boolean
  draft: string
  peerMetrics?: Record<string, PeerMetrics>
}

function coordinatorName(): string | null {
  if (self.coordinator) return self.name
  return self.coordinatorId ? remoteLabel(self.coordinatorId) : null
}

export function derive(): Snapshot {
  const snap: Snapshot = {
    name: self.name,
    coordinator: self.coordinator,
    coordinatorName: coordinatorName(),
    online: self.online,
    cursor: ui.cursor,
    expanded: [...ui.expanded],
    selfJoined: [...self.joined],
    remotes: Object.fromEntries(
      [...remotes].map(([rid, r]) => {
        const metrics = coordinatorLedger?.peerMetrics.get(rid)
        return [
          rid,
          {
            name: r.name,
            joined: [...r.joined],
            solveVelocity: metrics?.solveVelocity,
            avgAmplification: metrics?.avgAmplificationFactor,
          },
        ]
      }),
    ),
    counts: peerCounts(),
    feed: [...feed],
    composing: ui.composing,
    draft: ui.draft,
  }
  if (self.coordinator && coordinatorLedger) {
    snap.peerMetrics = Object.fromEntries(coordinatorLedger.peerMetrics)
  }
  return snap
}

export const useStore = create<{ tick: number; data: Snapshot }>(() => ({ tick: 0, data: derive() }))

export function notify() {
  useStore.setState((s) => ({ tick: s.tick + 1, data: derive() }))
}

// ---- feed ------------------------------------------------------------------

const timestamp = () => new Date().toTimeString().slice(0, 8)

function pushFeed(entry: FeedEntry) {
  feed.push(entry)
  if (feed.length > FEED_MAX) feed.shift()
  if (process.stdout.isTTY) notify()
  else console.log(entry.text) // headless: plain log lines
}

export function logEvent(text: string) {
  pushFeed({ kind: 'event', text: `${timestamp()}  ${text}` })
}

export function logChat(from: string, text: string) {
  pushFeed({ kind: 'chat', text: `${timestamp()}  ${from}: ${text}` })
}
