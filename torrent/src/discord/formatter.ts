// Format Hyperswarm room events for Discord display.

import type { RoomEvent } from './hyperswarm-client.ts'

export function formatRoomEvent(event: RoomEvent): string {
  const time = new Date(event.timestamp).toLocaleTimeString()
  switch (event.kind) {
    case 'fragment-submit':
      return `🔧 **Fragment submitted** [\`${time}\`]\nProblem: \`${event.data.problemId}\`\nSubproblem: \`${event.data.subproblemId}\`\nPreview: \`${event.data.contentPreview}\``
    case 'fragment-velocity':
      return `⚡ **Velocity reported** [\`${time}\`]\nFragment: \`${String(event.data.fragmentId).slice(0, 8)}\`\nAmplification: **${Number(event.data.amplificationFactor).toFixed(2)}x**`
    case 'compute-provide':
      return `💾 **Compute announced** [\`${time}\`]\nUnits: **${event.data.computeUnits}**\nRole: \`${event.data.role}\``
    case 'peer-join':
      return `✋ **Peer joined** [\`${time}\`]\nPeer: \`${event.data.peerId}\``
    case 'peer-leave':
      return `👋 **Peer left** [\`${time}\`]\nPeer: \`${event.data.peerId}\``
    case 'chat':
      return `💬 [\`${time}\`] **${event.data.from}**: ${event.data.text}`
    default:
      return `[${time}] ${event.kind}: ${JSON.stringify(event.data)}`
  }
}

export function formatRecord(events: RoomEvent[]): string {
  if (events.length === 0) return 'No recent activity in the room.'
  return events.map(formatRoomEvent).join('\n\n')
}
