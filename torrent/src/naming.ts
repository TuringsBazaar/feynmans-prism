// Every pear names itself: a device name from DESIGN.md's list, picked at
// random on first run and kept in identity.json. The COORDINATOR is the pear
// that has been in the room longest (ties by key); every pear computes the
// same answer from the hellos it has seen, so no election traffic is needed.
// Two pears wearing the same name: the newer one re-rolls and persists.

import { pickDeviceName, saveIdentity } from './identity.ts'
import { absorbBroadcasts } from './restructure.ts'
import { broadcastControl, hello } from './send.ts'
import { logEvent, notify, remoteLabel, remotes, self, shortId } from './state.ts'

// If peers are already connected when we come online, give their hellos this
// long to arrive before electing a coordinator among whoever answered. An
// empty room elects immediately.
const HELLO_GRACE_MS = 1_000
let helloGrace: NodeJS.Timeout | undefined

export function takenNames(): string[] {
  return [...remotes.values()].flatMap((r) => (r.name ? [r.name] : []))
}

export function rerollName(reason: string) {
  const next = pickDeviceName([self.name, ...takenNames()])
  self.name = next
  saveIdentity(self.home, { device: next })
  broadcastControl({ t: 'rename', name: next })
  logEvent(`renamed to ${next} (${reason})`)
  notify()
}

// The older pear keeps the name; a fixed --name never yields.
export function resolveNameCollision(rid: string, r: { name: string | null; since: number }) {
  if (r.name !== self.name || self.fixedName) return
  const weYield = self.since > r.since || (self.since === r.since && self.id > rid)
  if (weYield) rerollName(`${r.name} is taken by ${shortId(rid)}`)
}

export function becomeCoordinator(reason: string) {
  if (self.coordinator) return
  self.coordinator = true
  self.coordinatorId = null
  clearHelloGrace()
  absorbBroadcasts()
  logEvent(`coordinator: ${self.name} (${reason})`)
  broadcastControl(hello())
  notify()
}

export function demoteCoordinator(winnerId: string) {
  self.coordinator = false
  self.coordinatorId = winnerId
  logEvent(`yielding coordinator to ${remoteLabel(winnerId)}`)
  broadcastControl(hello())
  notify()
}

// Deterministic election among everyone who speaks the protocol: earliest
// start wins, ties by public key. Returns the winner's peerId, or null for self.
export function pickCoordinator(
  me: { id: string; since: number },
  others: Array<{ id: string; since: number }>,
): string | null {
  const all = [me, ...others]
  all.sort((a, b) => a.since - b.since || a.id.localeCompare(b.id))
  return all[0] === me ? null : all[0].id
}

export function elect(reason: string) {
  const others = [...remotes].filter(([, r]) => r.hello).map(([id, r]) => ({ id, since: r.since }))
  const winner = pickCoordinator({ id: self.id, since: self.since }, others)
  if (winner === null) becomeCoordinator(reason)
  else {
    self.coordinatorId = winner
    logEvent(`${remoteLabel(winner)} coordinates`)
    notify()
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
