import { test } from 'node:test'
import * as assert from 'node:assert'
import { initLedger, updateAmplificationFactor } from '../src/fragments.ts'
import { computeAssignments, scoreMetrics } from '../src/assignment.ts'

// Dummy tree: problem with 25 numbered subproblems
function dummyTree(problemId: string): string[] {
  return Array.from({ length: 25 }, (_, i) => `${problemId}-${i + 1}`)
}

function setupThreePeers(ledger: ReturnType<typeof initLedger>) {
  ledger.peerMetrics.set('peer-fast', {
    peerId: 'peer-fast',
    name: 'Fast Solver',
    fragmentsSubmitted: 10,
    avgAmplificationFactor: 1.2,
    solveVelocity: 5,
    computeBalance: 100,
  })
  ledger.peerMetrics.set('peer-quality', {
    peerId: 'peer-quality',
    name: 'Quality Researcher',
    fragmentsSubmitted: 3,
    avgAmplificationFactor: 1.8,
    solveVelocity: 1.5,
    computeBalance: 50,
  })
  ledger.peerMetrics.set('peer-new', {
    peerId: 'peer-new',
    name: 'New Joiner',
    fragmentsSubmitted: 0,
    avgAmplificationFactor: 0,
    solveVelocity: 0,
    computeBalance: 200,
  })
}

test('assignment algorithm weights peers by velocity and amplification', () => {
  const ledger = initLedger('test-problem')
  const subproblems = dummyTree('test-problem')
  setupThreePeers(ledger)
  const assignments = computeAssignments(ledger, subproblems)

  assert.equal(assignments.length, 25)
  const fastCount = assignments.filter((a) => a.peerId === 'peer-fast').length
  const qualityCount = assignments.filter((a) => a.peerId === 'peer-quality').length
  const newCount = assignments.filter((a) => a.peerId === 'peer-new').length

  assert.ok(fastCount > 0)
  assert.ok(qualityCount > 0)
  assert.ok(newCount > 0)
  assert.ok(fastCount >= qualityCount)
})

function submitFragmentsWithVelocities(
  ledger: ReturnType<typeof initLedger>,
  subproblems: string[],
  velocities: number[],
) {
  ledger.peerMetrics.set('peer-1', {
    peerId: 'peer-1',
    name: 'Researcher 1',
    fragmentsSubmitted: 0,
    avgAmplificationFactor: 0,
    solveVelocity: 0,
    computeBalance: 100,
  })

  for (let i = 0; i < velocities.length; i++) {
    const fragment = {
      id: `frag-${i}`,
      problemId: 'test-problem',
      subproblemId: subproblems[i],
      contributorId: 'peer-1',
      submittedAt: Date.now(),
      content: `solution-${i}`,
      amplificationFactors: [] as number[],
    }
    ledger.fragments.set(fragment.id, fragment)
    const metrics = ledger.peerMetrics.get('peer-1')!
    metrics.fragmentsSubmitted += 1
    metrics.solveVelocity = metrics.fragmentsSubmitted / 1
    updateAmplificationFactor(fragment, velocities[i])
  }
}

test('velocity and amplification accumulate across fragments', () => {
  const ledger = initLedger('test-problem')
  const subproblems = dummyTree('test-problem')
  const velocities = [1.3, 1.1, 1.5, 0.9, 1.2]
  submitFragmentsWithVelocities(ledger, subproblems, velocities)

  const peer1 = ledger.peerMetrics.get('peer-1')!
  assert.equal(peer1.fragmentsSubmitted, 5)
  assert.equal(peer1.solveVelocity, 5)

  const allFragments = [...ledger.fragments.values()].filter((f) => f.contributorId === 'peer-1')
  const total = allFragments.reduce((sum, f) => {
    const avg = f.amplificationFactors.reduce((a, b) => a + b, 0) / f.amplificationFactors.length
    return sum + avg
  }, 0)
  const avgAmpl = total / allFragments.length
  peer1.avgAmplificationFactor = avgAmpl

  assert.ok(avgAmpl > 1.0)
  assert.ok(Math.abs(avgAmpl - 1.2) < 0.1)
})

test('scoring favors high velocity with good amplification', () => {
  const fast = {
    peerId: 'fast',
    name: 'Fast',
    fragmentsSubmitted: 20,
    avgAmplificationFactor: 1.0,
    solveVelocity: 10,
    computeBalance: 100,
  }

  const quality = {
    peerId: 'quality',
    name: 'Quality',
    fragmentsSubmitted: 5,
    avgAmplificationFactor: 2.0,
    solveVelocity: 2.5,
    computeBalance: 100,
  }

  const fastScore = scoreMetrics(fast)
  const qualityScore = scoreMetrics(quality)

  // Fast: 10*10 + 1.0*5 = 105
  // Quality: 2.5*10 + 2.0*5 = 35
  assert.equal(fastScore, 105)
  assert.equal(qualityScore, 35)
  assert.ok(fastScore > qualityScore, 'Velocity weighted more heavily than amplification')
})
