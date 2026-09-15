// Process lifecycle: come online, keep the DHT lookup fresh, tear down cleanly.

import { clearHelloGrace, maybeElect } from './naming.ts'
import { join } from './presence.ts'
import type { Room } from './room.ts'
import { label, logEvent, notify, self } from './state.ts'

// Hyperswarm only re-looks-up a topic every ~10 minutes on its own, so poll
// often at first and back off once the room has settled.
const REFRESH_STEPS_MS = [3_000, 5_000, 10_000, 15_000, 30_000, 60_000]

let current: Room | null = null
let refreshStep = 0
let refreshTimer: NodeJS.Timeout | undefined
let shuttingDown = false

export function goOnline(room: Room, autoJoin: string | null) {
  current = room
  room.discovery
    .flushed()
    .then(() => {
      self.online = true
      logEvent(`${label()} online (room "${room.room}")`)
      if (self.fixedName && autoJoin) join(autoJoin)
      // Zero wait: an empty room elects us immediately; otherwise the hellos
      // already in flight decide, with a short grace for silent peers.
      maybeElect()
      notify()
    })
    .catch((err) => console.error(err))
  scheduleRefresh()
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.once(sig, () => void shutdown())
}

function scheduleRefresh() {
  const delay = REFRESH_STEPS_MS[Math.min(refreshStep++, REFRESH_STEPS_MS.length - 1)]
  refreshTimer = setTimeout(() => {
    current?.discovery.refresh().catch(() => {})
    scheduleRefresh()
  }, delay)
}

// Tear the swarm down on every exit path. Ink's exit() only unmounts the UI;
// the swarm's sockets would otherwise keep the process alive as an invisible
// "ghost" pear that stays announced on the DHT and holds its name.
export async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  if (refreshTimer) clearTimeout(refreshTimer)
  clearHelloGrace()
  try {
    await current?.swarm.destroy() // unannounces the topic and closes connections
  } catch {
    // ignore
  }
  process.exit(0)
}
