// Naming is centralised. The first pear in an empty room becomes the
// COORDINATOR: it takes the first name and owns the stack of free names
// (aman…lucy, then aayush…gwern). Every later pear starts unnamed, asks the
// coordinator, and the coordinator pops the next name off the stack. If the
// coordinator leaves, the member with the earliest name takes over — every pear
// computes the same successor, so no election traffic is needed.

import { PEAR_NAMES } from './data.ts'
import { flushPendingJoin } from './presence.ts'
import type { PeerSocket } from './room.ts'
import { broadcastControl, hello, sendControl } from './send.ts'
import { logEvent, notify, remoteLabel, remotes, self, shortId } from './state.ts'

// If peers are already connected when we come online, give their hellos this
// long to arrive before electing a coordinator among whoever answered. An
// empty room elects immediately.
const HELLO_GRACE_MS = 1_000
let helloGrace: NodeJS.Timeout | undefined

// Names handed out but whose owner has not yet re-said hello with the name.
// Keeps two back-to-back requests from popping the same entry.
export const reserved = new Map<string, string>() // peerId → name

// Timeout for waiting on coordinator to assign a name (5 seconds)
const NAME_REQUEST_TIMEOUT_MS = 5000
let nameRequestTimer: NodeJS.Timeout | undefined

export function nameRank(name: string | null): number {
  if (name === null) return Number.POSITIVE_INFINITY
  const i = PEAR_NAMES.indexOf(name)
  return i === -1 ? PEAR_NAMES.length : i
}

// Free names in canonical order. The head is the top of the stack.
export function freeNameStack(taken: Iterable<string | null>): string[] {
  const used = new Set<string | null>(taken)
  return PEAR_NAMES.filter((n) => !used.has(n))
}

function takenNames(): (string | null)[] {
  return [self.name, ...[...remotes.values()].map((r) => r.name), ...reserved.values()]
}

export function popFreeName(taken: Iterable<string | null> = takenNames()): string {
  const used = new Set<string | null>(taken)
  const stack = freeNameStack(used)
  if (stack.length > 0) return stack[0]
  // Pool exhausted: suffix the last canonical name with a counter.
  const base = PEAR_NAMES[PEAR_NAMES.length - 1]
  let k = 1
  while (used.has(`${base}-${k}`)) k++
  return `${base}-${k}`
}

export function setName(next: string, how: string) {
  const wasUnnamed = self.name === null
  self.name = next
  if (nameRequestTimer) clearTimeout(nameRequestTimer)
  nameRequestTimer = undefined
  broadcastControl(wasUnnamed ? hello() : { t: 'rename', name: next })
  logEvent(how)
  flushPendingJoin()
  notify()
}

export function becomeCoordinator(reason: string) {
  if (self.coordinator) return
  self.coordinator = true
  self.coordinatorId = null
  clearHelloGrace()
  logEvent(`coordinator: ${self.name ?? shortId(self.id)} (${reason})`)
  if (self.name === null) {
    const n = popFreeName()
    setName(n, `claimed ${n} as coordinator`)
  } else broadcastControl(hello())
  // Anyone already waiting on us gets served now.
  for (const [rid, r] of remotes) if (r.hello && r.name === null) assignName(rid, r.socket)
  notify()
}

export function demoteCoordinator(winnerId: string) {
  self.coordinator = false
  self.coordinatorId = winnerId
  reserved.clear()
  logEvent(`yielding coordinator to ${remoteLabel(winnerId)}`)
  // Our own name came off OUR stack, which the winner never saw. Give it up
  // BEFORE saying hello: otherwise the winner sees a plain member wearing its
  // name and renames itself instead of us.
  if (!self.fixedName) self.name = null
  broadcastControl(hello())
  requestName()
  notify()
}

export function assignName(peerId: string, socket: PeerSocket) {
  // Idempotent: a re-request (or a proactive assign racing a request) gets
  // the same reserved name instead of popping a second one off the stack.
  let name = reserved.get(peerId)
  if (!name) {
    name = popFreeName()
    reserved.set(peerId, name)
    logEvent(`assigned ${name} → ${shortId(peerId)}`)
  }
  sendControl(socket, { t: 'assign', name })
}

export function requestName() {
  if (self.fixedName || self.name !== null || self.coordinatorId === null) return
  const c = remotes.get(self.coordinatorId)
  if (c) sendControl(c.socket, { t: 'request-name' })

  // Clear old timer if any
  if (nameRequestTimer) clearTimeout(nameRequestTimer)

  // Set timeout: if no name arrives, give up and stay unnamed (will show as hash only)
  nameRequestTimer = setTimeout(() => {
    nameRequestTimer = undefined
    if (self.name === null) {
      logEvent(`${shortId(self.id)} timed out waiting for name; using hash`)
      notify()
    }
  }, NAME_REQUEST_TIMEOUT_MS)
}

// Deterministic election among everyone who speaks the protocol: lowest name
// rank wins, ties by public key. Every pear sees the same set, so every pear
// computes the same winner. Returns the winner's peerId, or null for self.
export function pickCoordinator(
  me: { id: string; name: string | null },
  others: Array<{ id: string; name: string | null }>,
): string | null {
  const all = [me, ...others]
  all.sort((a, b) => nameRank(a.name) - nameRank(b.name) || a.id.localeCompare(b.id))
  return all[0] === me ? null : all[0].id
}

export function elect(reason: string) {
  const others = [...remotes].filter(([, r]) => r.hello).map(([id, r]) => ({ id, name: r.name }))
  const winner = pickCoordinator({ id: self.id, name: self.name }, others)
  if (winner === null) becomeCoordinator(reason)
  else {
    self.coordinatorId = winner
    logEvent(`waiting for ${remoteLabel(winner)} to coordinate`)
    requestName()
  }
}

export function clearHelloGrace() {
  if (helloGrace) clearTimeout(helloGrace)
  helloGrace = undefined
}

// Called whenever the set of known hellos changes while we have no coordinator.
export function maybeElect() {
  if (self.coordinator || self.coordinatorId !== null || !self.online) return
  const connected = [...remotes.values()]
  if (connected.every((r) => r.hello)) {
    clearHelloGrace()
    elect(connected.length === 0 ? 'empty room' : 'no coordinator among peers')
  } else if (!helloGrace) {
    helloGrace = setTimeout(() => {
      helloGrace = undefined
      if (!self.coordinator && self.coordinatorId === null) elect('peers silent')
    }, HELLO_GRACE_MS)
  }
}
