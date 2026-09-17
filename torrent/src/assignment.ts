// Fragment assignment algorithm: allocate subproblems to peers based on metrics.
// For now: weighted by solve velocity (fragments/hour) and amplification factor.

import type { CoordinatorLedger, PeerMetrics } from './fragments.ts'

export interface Assignment {
  peerId: string
  subproblemId: string
  weight: number // higher = more deserving
}

export function scoreMetrics(metrics: PeerMetrics): number {
  if (metrics.fragmentsSubmitted === 0) return 0
  // Weight: solve velocity (productivity) + amplification factor (quality)
  const velScore = metrics.solveVelocity * 10 // fragments per hour
  const ampScore = metrics.avgAmplificationFactor * 5 // downstream impact
  return velScore + ampScore
}

export function computeAssignments(ledger: CoordinatorLedger, unassignedSubproblems: string[]): Assignment[] {
  const scores = new Map<string, number>()

  // Score each peer by their metrics
  for (const [peerId, metrics] of ledger.peerMetrics) {
    scores.set(peerId, scoreMetrics(metrics))
  }

  // Sort peers by score (descending)
  const sorted = [...scores.entries()].toSorted((a, b) => b[1] - a[1])

  // Round-robin: assign each subproblem to the highest-scoring available peer
  const assignments: Assignment[] = []
  for (let i = 0; i < unassignedSubproblems.length; i++) {
    const subproblemId = unassignedSubproblems[i]
    const peerIndex = i % sorted.length
    const [peerId, weight] = sorted[peerIndex]

    assignments.push({ peerId, subproblemId, weight })
  }

  return assignments
}
