import { test } from 'node:test'
import * as assert from 'node:assert'
import { initLedger, computeAvgAmplification, updateAmplificationFactor } from '../src/fragments.ts'

test('ledger init creates empty maps', () => {
  const ledger = initLedger('test-problem')
  assert.equal(ledger.problemId, 'test-problem')
  assert.equal(ledger.fragments.size, 0)
  assert.equal(ledger.computeProviders.size, 0)
  assert.equal(ledger.peerMetrics.size, 0)
})

test('fragment amplification factor tracks speedups', () => {
  const fragment = {
    id: 'f1',
    problemId: 'p1',
    subproblemId: 's1',
    contributorId: 'peer1',
    submittedAt: Date.now(),
    content: 'solution',
    amplificationFactors: [] as number[],
  }

  const avg1 = updateAmplificationFactor(fragment, 1.3)
  assert.equal(avg1, 1.3)
  assert.equal(fragment.amplificationFactors.length, 1)

  const avg2 = updateAmplificationFactor(fragment, 1.1)
  assert.ok(Math.abs(avg2 - 1.2) < 0.0001) // (1.3 + 1.1) / 2
  assert.equal(fragment.amplificationFactors.length, 2)
})

test('computeAvgAmplification returns 0 for empty', () => {
  const fragment = {
    id: 'f1',
    problemId: 'p1',
    subproblemId: 's1',
    contributorId: 'peer1',
    submittedAt: Date.now(),
    content: 'solution',
    amplificationFactors: [] as number[],
  }

  assert.equal(computeAvgAmplification(fragment), 0)
})

test('computeAvgAmplification handles single factor', () => {
  const fragment = {
    id: 'f1',
    problemId: 'p1',
    subproblemId: 's1',
    contributorId: 'peer1',
    submittedAt: Date.now(),
    content: 'solution',
    amplificationFactors: [1.5],
  }

  assert.equal(computeAvgAmplification(fragment), 1.5)
})
