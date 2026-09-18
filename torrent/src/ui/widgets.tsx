// Box-drawn widgets. Pure functions of a Snapshot; no protocol calls here.

import { Box, Text } from 'ink'
import type { Problem } from '../data.ts'
import type { Snapshot } from '../state.ts'

export const KEYS_HELP = '[j/k] move · [space] join/leave · [enter] expand · [m] message · [q] quit'

function fmtTok(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`
}

export function Header({ data }: { data: Snapshot }) {
  const total = Object.keys(data.remotes).length
  const role = data.coordinator
    ? ' · coordinator'
    : data.coordinatorName
      ? ` · coordinator: ${data.coordinatorName}`
      : ''
  return (
    <Box flexDirection="row" justifyContent="space-between">
      <Text>
        {data.online ? 'online' : 'connecting'} · {total} peers{role}
      </Text>
      <Text>device: {data.name}</Text>
    </Box>
  )
}

export function ProblemRow({ problem, index, data }: { problem: Problem; index: number; data: Snapshot }) {
  const joined = data.selfJoined.includes(problem.id)
  const open = data.expanded.includes(problem.id)
  const peers = data.counts[problem.id] ?? 0
  const peersStr = `${peers} peer${peers === 1 ? '' : 's'}${joined ? ' + you' : ''}`
  const selected = index === data.cursor && !data.composing
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between">
        <Text inverse={selected}>
          {joined ? '●' : '○'} {open ? '▼' : '▸'} {problem.title}
        </Text>
        <Text inverse={selected}>
          {peersStr} {fmtTok(problem.tokens)} tok
        </Text>
      </Box>
      {open ? <Subproblems problem={problem} /> : null}
    </Box>
  )
}

function Subproblems({ problem }: { problem: Problem }) {
  const last = problem.subproblems.length - 1
  return (
    <Box flexDirection="column" paddingLeft={6}>
      <Text dimColor wrap="wrap">
        {problem.statement}
      </Text>
      {problem.subproblems.map((sub, j) => (
        <Text key={j} wrap="wrap">
          {j === last ? '└' : '├'} {sub.text}
        </Text>
      ))}
    </Box>
  )
}

export function Feed({ data }: { data: Snapshot }) {
  return (
    <Box flexDirection="column">
      {data.feed.slice(-12).map((e, i) => (
        <Text key={`${e.text}-${i}`} dimColor={e.kind === 'event'}>
          {e.text}
        </Text>
      ))}
    </Box>
  )
}

export function Composer({ data }: { data: Snapshot }) {
  if (!data.composing) return <Text dimColor>{KEYS_HELP}</Text>
  return (
    <Text>
      <Text color="green">{'> '}</Text>
      {data.draft}
      <Text inverse> </Text>
      <Text dimColor> enter send · esc cancel</Text>
    </Text>
  )
}
