import { useState } from 'react'
import type { Problem } from '../types'
import { useStore } from '../store/store'
import { SubproblemList } from './SubproblemList'

interface Props {
  problem: Problem
}

export function ProblemRow({ problem }: Props) {
  const joined = useStore((s) => s.joined.has(problem.id))
  const count = useStore((s) => s.peerCounts[problem.id] ?? 0)
  const toggleJoin = useStore((s) => s.toggleJoin)
  const [expanded, setExpanded] = useState(false)

  return (
    <li className={`problem ${joined ? 'is-joined' : ''}`}>
      <div className="problem-head">
        <label className="join">
          <input
            type="checkbox"
            checked={joined}
            onChange={() => toggleJoin(problem.id)}
          />
          <span aria-hidden className={joined ? 'on' : 'off'}>
            {joined ? '●' : '○'}
          </span>
        </label>

        <button
          type="button"
          className="problem-title"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className="chevron">{expanded ? '▾' : '▸'}</span>
          <span className="title-text">{problem.title}</span>
        </button>

        <span className="peers">
          {count} peer{count === 1 ? '' : 's'}
          {joined ? <em className="you"> (you)</em> : null}
        </span>
      </div>

      {expanded ? (
        <div className="problem-body">
          <SubproblemList subproblems={problem.subproblems} />
          <div className="tokens">
            tokens:{' '}
            {problem.tokens === null ? '—' : problem.tokens.toLocaleString()}
          </div>
        </div>
      ) : null}
    </li>
  )
}