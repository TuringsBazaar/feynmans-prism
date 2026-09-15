export const agents = ['chair', 'aman', 'gwern', 'representer', 'compressor'] as const
export type Agent = (typeof agents)[number]
export type Route = { target: Agent; text: string; command?: 'status' | 'stop' | 'resume' | 'help' }

export function routeMessage(content: string, botId: string, last: Agent = 'chair'): Route {
  let text = content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim()
  let target = last
  const prefix = /^(chair|noera|neurips program chair|aman|gwern|representer|compressor):\s*/i.exec(text)
  if (prefix) {
    const name = prefix[1].toLowerCase()
    target = agents.includes(name as Agent) ? (name as Agent) : 'chair'
    text = text.slice(prefix[0].length).trim()
  }
  const command = /^(status|stop|resume|help)$/i.exec(text)?.[1].toLowerCase() as Route['command']
  return { target, text, command }
}

export function chunks(text: string, size = 1900): string[] {
  return Array.from({ length: Math.ceil(text.length / size) }, (_, i) => text.slice(i * size, (i + 1) * size))
}
