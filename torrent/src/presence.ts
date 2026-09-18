// What this pear does in the room: join/leave problems, say things, propose
// subproblems, and (as coordinator) settle the proposal queue.

import { onProposal, onReview } from './restructure.ts'
import { broadcastChat, broadcastControl } from './send.ts'
import { label, logChat, logEvent, self } from './state.ts'

export function join(problemId: string) {
  if (self.joined.has(problemId)) return
  self.joined.add(problemId)
  broadcastControl({ t: 'join', name: self.name, problemId })
  logEvent(`${self.name} joined ${problemId}`)
}

export function leave(problemId: string) {
  if (!self.joined.delete(problemId)) return
  broadcastControl({ t: 'leave', name: self.name, problemId })
  logEvent(`${self.name} left ${problemId}`)
}

export function say(text: string) {
  const t = text.trim()
  if (!t) return
  broadcastChat(t)
  logChat(label(), t)
}

// A proposal goes to the coordinator's queue. Broadcasts do not loop back, so
// the coordinator queues its own directly.
export function propose(problemId: string, text: string, parentId: string | null = null) {
  const t = text.trim()
  if (!t) return
  if (self.coordinator) onProposal(problemId, parentId, t, self.name)
  else {
    broadcastControl({ t: 'propose-subproblem', problemId, parentId, text: t })
    logEvent(`proposed for ${problemId}: ${t.slice(0, 60)}`)
  }
}

export function reviewAll() {
  if (!self.coordinator) return logEvent('only the coordinator settles proposals')
  const settled = onReview('all')
  if (!settled.length) logEvent('no proposals pending')
}
