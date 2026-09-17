export const agents = ['chair', 'aman', 'gwern', 'representer', 'compressor'] as const
export type Agent = (typeof agents)[number]

export type AgentRoute = {
  kind: 'agent'
  target: Agent
  text: string
  command?: 'status' | 'stop' | 'resume' | 'help'
}
export type RoomCommandRoute = {
  kind: 'room-command'
  command: 'record' | 'stir' | 'fragment-submit' | 'announce-compute'
  args: string[]
}
export type Route = AgentRoute | RoomCommandRoute

export function routeMessage(content: string, botId: string, last: Agent = 'chair'): Route {
  let text = content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim()

  const cmdMatch = /^!(record|stir|fragment-submit|announce-compute)\s*(.*)/i.exec(text)
  if (cmdMatch) {
    const cmd = cmdMatch[1].toLowerCase()
    const args = cmdMatch[2]
      .trim()
      .split(/\s+/)
      .filter((a) => a.length > 0)
    return {
      kind: 'room-command',
      command: cmd as 'record' | 'stir' | 'fragment-submit' | 'announce-compute',
      args,
    }
  }

  let target = last
  const prefix = /^(chair|noera|neurips program chair|aman|gwern|representer|compressor):\s*/i.exec(text)
  if (prefix) {
    const name = prefix[1].toLowerCase()
    target = agents.includes(name as Agent) ? (name as Agent) : 'chair'
    text = text.slice(prefix[0].length).trim()
  }
  const command = /^(status|stop|resume|help)$/i.exec(text)?.[1].toLowerCase() as AgentRoute['command']
  return { kind: 'agent', target, text, command }
}

export function chunks(text: string, size = 1900): string[] {
  return Array.from({ length: Math.ceil(text.length / size) }, (_, i) => text.slice(i * size, (i + 1) * size))
}
