// Fragment state and metrics: solve velocity (peer throughput) and amplification
// factor (downstream speedup). Coordinator holds the ledger; peers report progress.

export interface Fragment {
  id: string
  problemId: string
  subproblemId: string
  contributorId: string // peer who solved it
  submittedAt: number
  content: string
  amplificationFactors: number[] // downstream speedups [1.3, 1.1, ...]
}

export interface ComputeProvider {
  peerId: string
  name: string
  computeUnits: number
  role: 'provider' | 'researcher' | 'hybrid'
  announcedAt: number
}

export interface PeerMetrics {
  peerId: string
  name: string | null
  fragmentsSubmitted: number
  avgAmplificationFactor: number // mean of all fragments' ampl. factors
  solveVelocity: number // fragments per hour (or submitted count / time)
  computeBalance: number
}

export interface CoordinatorLedger {
  problemId: string
  fragments: Map<string, Fragment>
  computeProviders: Map<string, ComputeProvider>
  peerMetrics: Map<string, PeerMetrics>
  assignments: Map<string, { peerId: string; subproblemId: string; assignedAt: number }>
}

export function initLedger(problemId: string): CoordinatorLedger {
  return {
    problemId,
    fragments: new Map(),
    computeProviders: new Map(),
    peerMetrics: new Map(),
    assignments: new Map(),
  }
}

export function updateAmplificationFactor(fragment: Fragment, factor: number): number {
  fragment.amplificationFactors.push(factor)
  return fragment.amplificationFactors.reduce((a, b) => a + b, 0) / fragment.amplificationFactors.length
}

export function computeAvgAmplification(fragment: Fragment): number {
  if (fragment.amplificationFactors.length === 0) return 0
  return fragment.amplificationFactors.reduce((a, b) => a + b, 0) / fragment.amplificationFactors.length
}
