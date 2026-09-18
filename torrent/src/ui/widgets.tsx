// Box-drawn widgets. Pure functions of a Snapshot; no protocol calls here.

import { Box, Text } from 'ink'
import type { Problem } from '../data.ts'
import type { Snapshot } from '../state.ts'
import { buildTree, flatten, type GraphSnapshot, type TreeNode } from '../tree.ts'

export const KEYS_HELP =
  '[j/k] move · [space] join/leave · [enter] expand · [p] propose · [r] review · [m] message · [q] quit'

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
      <Text>
        device: {data.name}
        {data.user ? ` · you: ${data.user}` : ''}
      </Text>
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
      {open ? <Subproblems problem={problem} graph={data.graphs[problem.id]} /> : null}
    </Box>
  )
}

// The coordinator's graph when we have one, else the static list from data.ts.
function Subproblems({ problem, graph }: { problem: Problem; graph?: GraphSnapshot }) {
  const last = problem.subproblems.length - 1
  return (
    <Box flexDirection="column" paddingLeft={6}>
      <Text dimColor wrap="wrap">
        {problem.statement}
      </Text>
      {graph ? (
        <Tree graph={graph} />
      ) : (
        problem.subproblems.map((sub, j) => (
          <Text key={j} wrap="wrap">
            {j === last ? '└' : '├'} {sub.text}
          </Text>
        ))
      )}
    </Box>
  )
}

// ✓ solved · ○ ready · · blocked (a requirement is still open) · ✗ retired
function glyph(n: TreeNode) {
  if (n.status === 'solved') return '✓'
  if (n.status === 'retired') return '✗'
  return n.ready ? '○' : '·'
}

function Tree({ graph }: { graph: GraphSnapshot }) {
  const rows = flatten(buildTree(graph))
  return (
    <Box flexDirection="column">
      {rows.map(({ node, depth, last }) => (
        <Text key={node.id} wrap="wrap" dimColor={node.status !== 'open' || !node.ready}>
          {'  '.repeat(depth)}
          {last ? '└' : '├'} {glyph(node)} {node.id} {node.text}
        </Text>
      ))}
      {graph.pending.length ? (
        <Text color="yellow">
          {graph.pending.length} proposal{graph.pending.length === 1 ? '' : 's'} pending review
        </Text>
      ) : null}
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
      <Text color="green">{data.compose === 'propose' ? 'propose> ' : '> '}</Text>
      {data.draft}
      <Text inverse> </Text>
      <Text dimColor> enter send · esc cancel</Text>
    </Text>
  )
}
