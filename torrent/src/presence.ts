// What this pear does in the room: join/leave problems, say things.

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
