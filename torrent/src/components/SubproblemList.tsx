import type { Subproblem } from '../types'

interface Props {
  subproblems: Subproblem[]
}

export function SubproblemList({ subproblems }: Props) {
  return (
    <ul className="subproblems">
      {subproblems.map((subproblem, index) => (
        <li key={index} className="subproblem">
          <span className="kind">{subproblem.kind}</span>
          <span className="text">{subproblem.text}</span>
        </li>
      ))}
    </ul>
  )
}