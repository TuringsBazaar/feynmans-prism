export type ProblemId = string

export type SubproblemKind =
  | 'open_question'
  | 'assumption'
  | 'conclusion'
  | 'limitation'

export interface Subproblem {
  kind: SubproblemKind
  text: string
}

export interface Problem {
  id: ProblemId
  title: string
  subproblems: Subproblem[]
  tokens: number | null
}

export interface StateMessage {
  t: 'state'
  room: string
  self: string
  remotes: string[]
  selfJoined: ProblemId[]
  counts: Record<ProblemId, number>
}

export type ClientMessage =
  | { t: 'join'; problemId: ProblemId }
  | { t: 'leave'; problemId: ProblemId }