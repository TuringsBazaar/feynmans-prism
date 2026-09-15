// What this pear does in the room: join/leave problems, say things.

import { broadcastChat, broadcastControl } from './send.ts'
import { label, logChat, logEvent, self } from './state.ts'

export function join(problemId: string) {
  if (self.name === null) {
    self.pendingAutoJoin = problemId // deferred until we have a name to announce
    return
  }
  if (self.joined.has(problemId)) return
  self.joined.add(problemId)
  broadcastControl({ t: 'join', name: self.name, problemId })
  logEvent(`${self.name} joined ${problemId}`)
}

export function leave(problemId: string) {
  if (self.name === null || !self.joined.delete(problemId)) return
  broadcastControl({ t: 'leave', name: self.name, problemId })
  logEvent(`${self.name} left ${problemId}`)
}

// Called once a name arrives: perform the join that was waiting on it.
export function flushPendingJoin() {
  const p = self.pendingAutoJoin
  if (!p) return
  self.pendingAutoJoin = null
  join(p)
}

export function say(text: string) {
  const t = text.trim()
  if (!t) return
  broadcastChat(t)
  logChat(label(), t)
}
