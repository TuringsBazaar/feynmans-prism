import { create } from 'zustand'
import type { Problem, ProblemId, StateMessage } from '../types'
import { PROBLEMS } from '../data/problems'
import { NAMED_PEARS } from '../data/peers'
import { send } from '../net/pear-client'
import { playSound } from '../audio'

interface TorrentState {
  problems: Problem[]
  namedPeers: readonly string[]
  remotes: string[]
  joined: Set<ProblemId>
  peerCounts: Record<ProblemId, number>
  room: string
  self: string
  connected: boolean
  toggleJoin: (id: ProblemId) => void
  applyState: (msg: StateMessage) => void
  setConnected: (value: boolean) => void
}

export const useStore = create<TorrentState>((set, get) => ({
  problems: PROBLEMS,
  namedPeers: NAMED_PEARS,
  remotes: [],
  joined: new Set(),
  peerCounts: {},
  room: '',
  self: '',
  connected: false,

  toggleJoin: (id) => {
    const next = new Set(get().joined)
    const enabling = !next.has(id)
    if (enabling) next.add(id)
    else next.delete(id)
    set({ joined: next })
    playSound(enabling)
    send(enabling ? { t: 'join', problemId: id } : { t: 'leave', problemId: id })
  },

  applyState: (msg) =>
    set({
      room: msg.room,
      self: msg.self,
      remotes: msg.remotes,
      joined: new Set(msg.selfJoined),
      peerCounts: msg.counts,
    }),

  setConnected: (value) => set({ connected: value }),
}))