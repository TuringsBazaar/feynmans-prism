// Outbound messages to the room. The only module that writes to sockets on
// behalf of the pear; everyone else calls these.

import { writeAll, type PeerSocket } from './room.ts'
import { label, remotes, self } from './state.ts'
import { encodeChat, encodeControl, type Control } from './wire.ts'

const sockets = () => [...remotes.values()].map((r) => r.socket)

export function sendControl(socket: PeerSocket, msg: Control) {
  socket.write(encodeControl(msg))
}

export function broadcastControl(msg: Control) {
  writeAll(sockets(), encodeControl(msg))
}

export function broadcastChat(text: string) {
  writeAll(sockets(), encodeChat(label(), text))
}

export function hello(): Control {
  return {
    t: 'hello',
    name: self.name,
    joined: [...self.joined],
    coordinator: self.coordinator,
    since: self.since,
  }
}

export function submitFragment(problemId: string, subproblemId: string, content: string): Control {
  return {
    t: 'submit-fragment',
    problemId,
    subproblemId,
    content,
  }
}

export function reportVelocity(fragmentId: string, amplificationFactor: number): Control {
  return {
    t: 'report-velocity',
    fragmentId,
    amplificationFactor,
  }
}

export function announceCompute(computeUnits: number, role: 'provider' | 'researcher' | 'hybrid'): Control {
  return {
    t: 'compute-provide',
    computeUnits,
    role,
  }
}

export function announceAssignment(problemId: string, subproblemId: string): Control {
  return {
    t: 'assign-fragment',
    problemId,
    subproblemId,
  }
}
