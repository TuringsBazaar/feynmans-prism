import { useStore } from '../store/store'
import { ProblemRow } from './ProblemRow'

export function ProblemList() {
  const problems = useStore((s) => s.problems)

  return (
    <ul className="problems">
      {problems.map((problem) => (
        <ProblemRow key={problem.id} problem={problem} />
      ))}
    </ul>
  )
}