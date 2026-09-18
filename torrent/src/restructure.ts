// Dynamic restructuring of the problem graph, run by the coordinator only.
//
// Two kinds of change, two policies:
//   automatic — a fragment solves its node, spawns the subproblems it
//     uncovered, and unlocks whatever depended on it; an amplification report
//     reinforces or drops the roads into that node. No human in the loop.
//   queued    — a human-proposed subproblem waits in the review queue. The
//     queue accumulates and is settled in batches (`r` in the TUI, or
//     `pnpm review`), the same rhythm as fragments piling up for peer review.
//
// After every change the coordinator broadcasts the problem's snapshot; peers
// render that. The graph lives in `<home>/graph.sqlite` beside identity.json.

import { join } from 'node:path'
import { PROBLEMS } from './data.ts'
import { Graph } from './graph.ts'
import type { PeerSocket } from './room.ts'
import { broadcastControl, sendControl } from './send.ts'
import { graphs, logEvent, notify, self } from './state.ts'
import { newlyReady, readySet, type Proposal } from './tree.ts'

let db: Graph | null = null

export function graph(): Graph {
  if (!db) db = openGraph(self.home ? join(self.home, 'graph.sqlite') : ':memory:')
  return db
}

// Tests and fresh coordinators: point at a file (or memory), seeded.
export function openGraph(path: string): Graph {
  db?.close()
  db = new Graph(path)
  db.seed(PROBLEMS)
  return db
}

function publish(problemId: string) {
  const snap = graph().snapshot(problemId)
  graphs.set(problemId, snap)
  broadcastControl({ t: 'graph', ...snap })
  notify()
}

// A newcomer gets every problem's graph in its hello exchange.
export function publishTo(socket: PeerSocket) {
  for (const problemId of graph().problems())
    sendControl(socket, { t: 'graph', ...graph().snapshot(problemId) })
}

// On taking over: whatever the previous coordinator last broadcast is the
// truth, and it may be newer than this pear's own file.
export function absorbBroadcasts() {
  for (const snap of graphs.values()) graph().absorb(snap)
  for (const problemId of graph().problems()) graphs.set(problemId, graph().snapshot(problemId))
}

// A fragment solves its node. A node the tree never listed is created on the
// spot — a peer worked on something the decomposition missed — and each
// spawned subproblem becomes a child that required the solved node.
// Returns the ids of existing nodes the fragment unlocked (spawned children
// are ready at once but are reported as spawned, not unlocked).
export function onFragmentSolved(problemId: string, subproblemId: string, spawns: string[] = []): string[] {
  const g = graph()
  const before = readySet(g.snapshot(problemId))
  if (!g.node(problemId, subproblemId))
    g.addNode(problemId, subproblemId, { id: subproblemId, origin: 'fragment' })
  g.setStatus(problemId, subproblemId, 'solved')
  const spawned = new Set<string>()
  for (const text of spawns) {
    const child = g.addNode(problemId, text, { parentId: subproblemId, origin: 'fragment' })
    g.link(problemId, child.id, subproblemId)
    spawned.add(child.id)
  }
  const unlocked = newlyReady(before, readySet(g.snapshot(problemId))).filter((id) => !spawned.has(id))
  if (spawns.length)
    logEvent(`${subproblemId} spawned ${spawns.length} subproblem${spawns.length === 1 ? '' : 's'}`)
  if (unlocked.length) logEvent(`${subproblemId} unlocks ${unlocked.join(', ')}`)
  publish(problemId)
  return unlocked
}

// Downstream speedup reinforces every road into the solved node; a road
// that decays to the floor is dropped, which may unblock its source.
export function onAmplification(problemId: string, subproblemId: string, factor: number) {
  const before = readySet(graph().snapshot(problemId))
  const dropped = graph().reinforce(problemId, subproblemId, factor)
  for (const e of dropped) logEvent(`road ${e.src} → ${e.dst} demoted: no amplification`)
  const unlocked = newlyReady(before, readySet(graph().snapshot(problemId)))
  if (unlocked.length) logEvent(`dropped roads free ${unlocked.join(', ')}`)
  publish(problemId)
}

export function onProposal(
  problemId: string,
  parentId: string | null,
  text: string,
  proposer: string,
): Proposal {
  const p = graph().propose(problemId, parentId, text, proposer)
  const n = graph().pending().length
  logEvent(`proposal #${p.id} for ${problemId} queued by ${proposer} (${n} pending)`)
  publish(problemId)
  return p
}

// Settle a batch; `approve` may be 'all'.
export function onReview(approve: number[] | 'all', reject: number[] = []): Proposal[] {
  const g = graph()
  const ids = approve === 'all' ? g.pending().map((p) => p.id) : approve
  const settled = [...g.review(ids, 'approved'), ...g.review(reject, 'rejected')]
  for (const p of settled) logEvent(`proposal #${p.id} ${p.status}: ${p.text.slice(0, 60)}`)
  for (const problemId of new Set(settled.map((p) => p.problemId))) publish(problemId)
  return settled
}
