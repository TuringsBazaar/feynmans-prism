import assert from 'node:assert/strict'
import { beforeEach, it } from 'node:test'
import {
  absorbBroadcasts,
  graph,
  onAmplification,
  onFragmentSolved,
  onProposal,
  onReview,
  openGraph,
} from '../src/restructure.ts'
import { graphs, self } from '../src/state.ts'
import { readySet } from '../src/tree.ts'

const P = 'credit-assignment'

beforeEach(() => {
  openGraph(':memory:')
  graphs.clear()
  self.coordinator = true
  self.name = 'Eridanus'
})

it('a fragment solves its node, spawns children, and unlocks dependents', () => {
  graph().link(P, 'q2', 'q1')
  const unlocked = onFragmentSolved(P, 'q1', ['follow-up A', 'follow-up B'])
  assert.deepEqual(unlocked, ['q2'])
  const snap = graphs.get(P)
  assert.ok(snap)
  assert.equal(snap.nodes.find((n) => n.id === 'q1')?.status, 'solved')
  const spawned = snap.nodes.filter((n) => n.parentId === 'q1')
  assert.deepEqual(
    spawned.map((n) => n.text),
    ['follow-up A', 'follow-up B'],
  )
  // Children required the (now solved) parent, so they are ready at once.
  assert.ok(spawned.every((n) => readySet(snap).has(n.id)))
})

it('a fragment for an unlisted subproblem adds it to the graph', () => {
  onFragmentSolved(P, 'q99')
  assert.equal(graph().node(P, 'q99')?.origin, 'fragment')
  assert.equal(graph().node(P, 'q99')?.status, 'solved')
})

it('no amplification demotes the road and frees its source', () => {
  graph().link(P, 'q2', 'q1')
  onAmplification(P, 'q1', 0.01)
  assert.equal(graph().edges(P).length, 0)
  assert.ok(readySet(graphs.get(P)!).has('q2'))
})

it('proposals queue up and a batch review materializes them', () => {
  onProposal(P, null, 'first', 'Thrace')
  onProposal(P, 'q1', 'second', 'Diana')
  assert.equal(graphs.get(P)?.pending.length, 2)
  const settled = onReview('all')
  assert.equal(settled.length, 2)
  assert.equal(graphs.get(P)?.pending.length, 0)
  const added = graph()
    .nodes(P)
    .filter((n) => n.origin === 'proposal')
  assert.deepEqual(
    added.map((n) => n.parentId),
    [null, 'q1'],
  )
})

it('a new coordinator absorbs the last broadcast', () => {
  onFragmentSolved(P, 'q1', ['grown'])
  const last = graphs.get(P)!
  openGraph(':memory:') // fresh pear, seed only
  assert.equal(graph().node(P, 'q1')?.status, 'open')
  graphs.set(P, last)
  absorbBroadcasts()
  assert.equal(graph().node(P, 'q1')?.status, 'solved')
  assert.equal(graph().nodes(P).length, 11)
})
