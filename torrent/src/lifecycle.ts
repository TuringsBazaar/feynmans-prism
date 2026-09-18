// Process lifecycle: come online, keep sweeping for new pears, tear down cleanly.

import { clearHelloGrace, maybeElect } from './naming.ts'
import { join } from './presence.ts'
import type { Room } from './room.ts'
import { label, logEvent, notify, self } from './state.ts'

// A sweep dials every port of every visible host, so poll often at first and
// back off once the room has settled.
const REFRESH_STEPS_MS = [3_000, 5_000, 10_000, 15_000, 30_000, 60_000]

let current: Room | null = null
let refreshStep = 0
let refreshTimer: NodeJS.Timeout | undefined
let shuttingDown = false

export function goOnline(room: Room, autoJoin: string | null) {
  current = room
  room
    .ready()
    .then(() => {
      self.online = true
      logEvent(`${label()} online (room "${room.room}", ${room.transport} :${room.port})`)
      if (autoJoin) join(autoJoin)
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
    current?.refresh().catch(() => {})
    scheduleRefresh()
  }, delay)
}

// Tear the room down on every exit path. Ink's exit() only unmounts the UI;
// the sockets would otherwise keep the process alive as an invisible "ghost"
// pear that still answers dials and holds its name.
export async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  if (refreshTimer) clearTimeout(refreshTimer)
  clearHelloGrace()
  try {
    await current?.close()
  } catch {
    // ignore
  }
  process.exit(0)
}
