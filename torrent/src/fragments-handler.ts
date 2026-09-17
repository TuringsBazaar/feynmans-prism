// Coordinator-side handlers for fragment submission and velocity reporting.

import { self, coordinatorLedger, initCoordinatorLedger, notify, logEvent } from './state.ts'
import type { Fragment } from './fragments.ts'
import { updateAmplificationFactor, computeAvgAmplification } from './fragments.ts'
import crypto from 'crypto'

function initContributorMetrics(peerId: string, name: string | null) {
  return {
    peerId,
    name,
    fragmentsSubmitted: 0,
    avgAmplificationFactor: 0,
    solveVelocity: 0,
    computeBalance: 0,
  }
}

function updateSolveVelocity(peerId: string) {
  const metrics = coordinatorLedger?.peerMetrics.get(peerId)
  if (!metrics) return
  const elapsed = (Date.now() - self.since) / (1000 * 60 * 60) // hours
  metrics.solveVelocity = metrics.fragmentsSubmitted / Math.max(elapsed, 0.1)
}

function recordFragmentSubmission(fragmentId: string, subproblemId: string) {
  if (!coordinatorLedger) return
  let metrics = coordinatorLedger.peerMetrics.get(self.id)
  if (!metrics) {
    metrics = initContributorMetrics(self.id, self.name)
    coordinatorLedger.peerMetrics.set(self.id, metrics)
  }
  metrics.fragmentsSubmitted += 1
  updateSolveVelocity(self.id)
  logEvent(`Fragment ${fragmentId.slice(0, 8)} submitted to ${subproblemId}`)
}

export function handleSubmitFragment(
  problemId: string,
  subproblemId: string,
  content: string,
): string | null {
  if (!self.coordinator) return null
  if (!coordinatorLedger) initCoordinatorLedger(problemId)
  if (!coordinatorLedger || coordinatorLedger.problemId !== problemId) {
    return null
  }

  const fragmentId = crypto.randomBytes(8).toString('hex')
  const fragment: Fragment = {
    id: fragmentId,
    problemId,
    subproblemId,
    contributorId: self.id,
    submittedAt: Date.now(),
    content,
    amplificationFactors: [],
  }

  coordinatorLedger.fragments.set(fragmentId, fragment)
  recordFragmentSubmission(fragmentId, subproblemId)
  notify()
  return fragmentId
}

export function handleReportVelocity(fragmentId: string, amplificationFactor: number): void {
  if (!self.coordinator || !coordinatorLedger) return

  const fragment = coordinatorLedger.fragments.get(fragmentId)
  if (!fragment) {
    logEvent(`Velocity report ignored: fragment ${fragmentId.slice(0, 8)} not found`)
    return
  }

  const avgAmpl = updateAmplificationFactor(fragment, amplificationFactor)

  const contribMetrics = coordinatorLedger.peerMetrics.get(fragment.contributorId)
  if (contribMetrics) {
    contribMetrics.avgAmplificationFactor = averageAmplificationForPeer(fragment.contributorId)
  }

  logEvent(
    `Fragment ${fragmentId.slice(0, 8)} velocity: ${amplificationFactor.toFixed(2)}x (avg: ${avgAmpl.toFixed(2)}x)`,
  )
  notify()
}

function initComputeProviderMetrics(peerId: string, name: string | null, computeUnits: number) {
  return {
    peerId,
    name,
    fragmentsSubmitted: 0,
    avgAmplificationFactor: 0,
    solveVelocity: 0,
    computeBalance: computeUnits,
  }
}

export function handleComputeProvide(
  peerId: string,
  name: string | null,
  computeUnits: number,
  role: 'provider' | 'researcher' | 'hybrid',
): void {
  if (!self.coordinator || !coordinatorLedger) return

  coordinatorLedger.computeProviders.set(peerId, {
    peerId,
    name: name || 'unknown',
    computeUnits,
    role,
    announcedAt: Date.now(),
  })

  let metrics = coordinatorLedger.peerMetrics.get(peerId)
  if (!metrics) {
    metrics = initComputeProviderMetrics(peerId, name, computeUnits)
    coordinatorLedger.peerMetrics.set(peerId, metrics)
  } else {
    metrics.computeBalance = computeUnits
  }

  logEvent(`${name || peerId.slice(0, 8)} announces ${computeUnits} units (${role})`)
  notify()
}

function averageAmplificationForPeer(peerId: string): number {
  if (!coordinatorLedger) return 0
  const fragments = [...coordinatorLedger.fragments.values()].filter((f) => f.contributorId === peerId)
  if (fragments.length === 0) return 0
  const total = fragments.reduce((sum, f) => sum + computeAvgAmplification(f), 0)
  return total / fragments.length
}

export function handleAssignmentPickup(problemId: string, subproblemId: string, peerId: string): void {
  if (!self.coordinator || !coordinatorLedger) return

  const assignmentId = `${problemId}:${subproblemId}:${peerId}`
  if (coordinatorLedger.assignments.has(assignmentId)) {
    return // already recorded
  }

  coordinatorLedger.assignments.set(assignmentId, {
    peerId,
    subproblemId,
    assignedAt: Date.now(),
  })

  logEvent(`${subproblemId} assigned to ${peerId.slice(0, 8)}`)
  notify()
}
