import { useStore } from '../store/store'

export function PearRoster() {
  const namedPeers = useStore((s) => s.namedPeers)
  const remotes = useStore((s) => s.remotes)

  return (
    <aside className="pears">
      <h2>pears</h2>
      <ul>
        {namedPeers.map((name) => (
          <li key={name} className="pear empty" title="empty pear (not connected)">
            <span className="dot" />
            {name}
          </li>
        ))}
        {remotes.map((key) => (
          <li key={key} className="pear" title="connected peer">
            <span className="dot live" />
            {key}
          </li>
        ))}
      </ul>
    </aside>
  )
}