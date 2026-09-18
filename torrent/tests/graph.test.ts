import assert from 'node:assert/strict'
import { it } from 'node:test'
import { PROBLEMS } from '../src/data.ts'
import { Graph } from '../src/graph.ts'
import { buildTree, flatten, newlyReady, nextId, readySet, WEIGHT_FLOOR } from '../src/tree.ts'

const P = 'credit-assignment'

it('seeds the hardcoded subproblems once, skipping placeholders', () => {
  const g = new Graph()
  g.seed(PROBLEMS)
  g.seed(PROBLEMS)
  assert.equal(g.nodes(P).length, PROBLEMS[0].subproblems.length)
  assert.deepEqual(g.problems(), [P])
  assert.equal(g.node(P, 'q1')?.origin, 'seed')
  g.close()
})

it('allocates the next q-id and nests children', () => {
  const g = new Graph()
  g.seed(PROBLEMS)
  const n = g.addNode(P, 'a child', { parentId: 'q3', origin: 'fragment' })
  assert.equal(n.id, 'q11')
  assert.equal(n.parentId, 'q3')
  const tree = buildTree(g.snapshot(P))
  assert.equal(tree.length, 10)
  assert.equal(tree[2].children[0].id, 'q11')
  assert.equal(flatten(tree).length, 11)
  g.close()
})

it('readiness follows requires-edges; solving unlocks', () => {
  const g = new Graph()
  g.seed(PROBLEMS)
  g.link(P, 'q2', 'q1')
  const before = readySet(g.snapshot(P))
  assert.ok(!before.has('q2'))
  assert.ok(before.has('q1'))
  g.setStatus(P, 'q1', 'solved')
  const after = readySet(g.snapshot(P))
  assert.deepEqual(newlyReady(before, after), ['q2'])
  g.close()
})

it('reinforce scales roads into a node and drops them at the floor', () => {
  const g = new Graph()
  g.seed(PROBLEMS)
  g.link(P, 'q2', 'q1')
  g.link(P, 'q3', 'q1')
  assert.deepEqual(g.reinforce(P, 'q1', 1.5), [])
  assert.equal(g.edges(P)[0].weight, 1.5)
  const dropped = g.reinforce(P, 'q1', WEIGHT_FLOOR / 10)
  assert.deepEqual(
    dropped.map((e) => e.src),
    ['q2', 'q3'],
  )
  assert.equal(g.edges(P).length, 0)
  g.close()
})

it('queues proposals and settles them in a batch', () => {
  const g = new Graph()
  g.seed(PROBLEMS)
  const a = g.propose(P, null, 'top level', 'Eridanus')
  const b = g.propose(P, 'q1', 'under q1', 'Thrace')
  const c = g.propose(P, 'gone', 'orphan parent', 'Diana')
  assert.equal(g.pending().length, 3)
  const settled = g.review([a.id, c.id], 'approved')
  assert.deepEqual(
    settled.map((p) => p.status),
    ['approved', 'approved'],
  )
  assert.equal(g.pending().length, 1)
  assert.equal(g.review([b.id], 'rejected')[0].status, 'rejected')
  assert.equal(g.review([b.id], 'approved').length, 0) // already settled
  const nodes = g.nodes(P).filter((n) => n.origin === 'proposal')
  assert.equal(nodes.length, 2)
  assert.equal(nodes[1].parentId, null) // unknown parent dropped, not failed
  g.close()
})

it('absorbs a broadcast snapshot verbatim', () => {
  const src = new Graph()
  src.seed(PROBLEMS)
  src.addNode(P, 'grown', { parentId: 'q1', origin: 'fragment' })
  src.link(P, 'q11', 'q1', 2)
  src.setStatus(P, 'q1', 'solved')
  src.propose(P, null, 'pending one', 'Naiad')
  const dst = new Graph()
  dst.seed(PROBLEMS)
  dst.absorb(src.snapshot(P))
  assert.deepEqual(dst.snapshot(P), src.snapshot(P))
  src.close()
  dst.close()
})

it('nextId counts from the highest existing q-number', () => {
  assert.equal(nextId([]), 'q1')
  assert.equal(nextId([{ id: 'q2' }, { id: 'q10' }, { id: 'weird' }]), 'q11')
})
