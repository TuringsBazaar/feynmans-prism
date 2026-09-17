// Inbound side of the protocol: one connection per remote pear. Registers the
// remote, greets it, and dispatches each incoming line to chat or control.

import {
  assignName,
  clearHelloGrace,
  demoteCoordinator,
  elect,
  maybeElect,
  popFreeName,
  requestName,
  reserved,
  setName,
} from './naming.ts'
import { peerId, readLines, type PeerSocket } from './room.ts'
import { hello, sendControl } from './send.ts'
import { logChat, logEvent, notify, remoteLabel, remotes, self, shortId, type Remote } from './state.ts'
import { parseChat, parseControl, type Control, type ControlOf } from './wire.ts'
import {
  handleAssignmentPickup,
  handleComputeProvide,
  handleReportVelocity,
  handleSubmitFragment,
} from './fragments-handler.ts'

export function onConnection(socket: PeerSocket) {
  const rid = peerId(socket)
  remotes.set(rid, { name: null, joined: new Set(), socket, coordinator: false, hello: false, since: 0 })
  sendControl(socket, hello())
  notify()

  readLines(socket, (raw) => {
    const r = remotes.get(rid)
    if (r && r.socket === socket) onLine(rid, r, raw)
  })
  socket.on('close', () => onClose(rid, socket))
}

function handleFragmentControl(msg: Partial<Control> & { t: string }, fromId: string) {
  switch (msg.t) {
    case 'compute-provide': {
      const m = msg as ControlOf<'compute-provide'>
      return handleComputeProvide(fromId, remoteLabel(fromId), m.computeUnits, m.role)
    }
    case 'submit-fragment': {
      const m = msg as ControlOf<'submit-fragment'>
      return handleSubmitFragment(m.problemId, m.subproblemId, m.content)
    }
    case 'report-velocity': {
      const m = msg as ControlOf<'report-velocity'>
      return handleReportVelocity(m.fragmentId, m.amplificationFactor)
    }
    case 'assign-fragment': {
      const m = msg as ControlOf<'assign-fragment'>
      return handleAssignmentPickup(m.problemId, m.subproblemId, fromId)
    }
  }
}

function onLine(rid: string, r: Remote, raw: string) {
  const msg = parseControl(raw)
  if (msg === null) {
    const chat = parseChat(raw)
    if (chat) logChat(chat.from ?? remoteLabel(rid), chat.text)
    return
  }
  switch (msg.t) {
    case 'hello':
      return onHello(rid, r, msg as ControlOf<'hello'>)
    case 'rename':
      return onRename(rid, r, msg as ControlOf<'rename'>)
    case 'request-name':
      if (self.coordinator) assignName(rid, r.socket)
      return
    case 'assign':
      return onAssign(rid, msg as ControlOf<'assign'>)
    case 'join':
    case 'leave':
      return onMembership(rid, r, msg as ControlOf<'join' | 'leave'>)
    default:
      return handleFragmentControl(msg, rid)
  }
}

function onHello(rid: string, r: Remote, m: ControlOf<'hello'>) {
  const firstHello = !r.hello
  const gotName = r.name === null && m.name != null
  r.hello = true
  r.name = m.name ?? null
  r.joined = new Set(m.joined ?? [])
  r.coordinator = Boolean(m.coordinator)
  r.since = m.since ?? Date.now()
  if (r.name) reserved.delete(rid) // it has a name now, whatever it is

  if (firstHello) logEvent(`${remoteLabel(rid)} connected`)
  else if (gotName) logEvent(`${shortId(rid)} is ${r.name}`)
  if (firstHello || gotName) for (const p of r.joined) logEvent(`${remoteLabel(rid)} joined ${p}`)

  resolveCoordination(rid, r)
  resolveNameCollision(r)
  notify()
}

function resolveCoordination(rid: string, r: Remote) {
  if (r.coordinator) {
    if (!self.coordinator) {
      self.coordinatorId = rid
      clearHelloGrace()
      requestName()
      return
    }
    // Two coordinators: both started in an empty room. Earlier start wins.
    const theyWin = r.since < self.since || (r.since === self.since && rid < self.id)
    if (theyWin) demoteCoordinator(rid)
  } else if (self.coordinator && r.name === null && !reserved.has(rid)) {
    // Unnamed member that hasn't asked yet (e.g. we became coordinator after
    // it connected). Serve it proactively.
    assignName(rid, r.socket)
  } else {
    maybeElect()
  }
}

// Backstop: a fixed --name collided with an assigned one. Skip when the other
// side is a coordinator — the coordinator tiebreak decides who yields, and the
// loser already gave its name up.
function resolveNameCollision(r: Remote) {
  if (self.name === null || r.name !== self.name || self.fixedName || r.coordinator) return
  self.name = null
  if (self.coordinator) {
    const n = popFreeName()
    setName(n, `renamed to ${n} (collision)`)
  } else requestName()
}

function onRename(rid: string, r: Remote, m: ControlOf<'rename'>) {
  const before = remoteLabel(rid)
  r.name = m.name ?? r.name
  logEvent(`${before} is now ${r.name}`)
  notify()
}

function onAssign(rid: string, m: ControlOf<'assign'>) {
  if (rid === self.coordinatorId && self.name === null && !self.fixedName)
    setName(m.name, `assigned ${m.name}`)
}

function onMembership(rid: string, r: Remote, m: ControlOf<'join' | 'leave'>) {
  const who = m.name ?? remoteLabel(rid)
  if (m.t === 'join') r.joined.add(m.problemId ?? '')
  else r.joined.delete(m.problemId ?? '')
  logEvent(`${who} ${m.t === 'join' ? 'joined' : 'left'} ${m.problemId}`)
  notify()
}

function onClose(rid: string, socket: PeerSocket) {
  const entry = remotes.get(rid)
  // Only drop the entry if this closing socket is still the active one —
  // otherwise a replaced connection would erase the fresh replacement.
  if (!entry || entry.socket !== socket) return
  const who = remoteLabel(rid)
  remotes.delete(rid)
  reserved.delete(rid) // name goes back on the stack
  logEvent(`${who} disconnected`)
  if (rid === self.coordinatorId) {
    self.coordinatorId = null
    elect('previous coordinator left')
  }
  notify()
}
