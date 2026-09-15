import { readFileSync } from 'node:fs'

export interface Persona {
  name: string
  system: string
  replyTo?: string[]
  noReply?: boolean
  stir?: boolean
  stirEveryMs?: number
  stirIdleMs?: number
}

export function parsePersonas(markdown: string): Record<string, Persona> {
  const blocks = [...markdown.matchAll(/```json\s*\n([\s\S]*?)```/g)]
  if (blocks.length !== 1) throw new Error('PEARS.md must contain exactly one JSON block')
  const data = JSON.parse(blocks[0][1])
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid persona map')
  for (const [id, p] of Object.entries(data) as [string, Persona][]) {
    if (!/^[a-z]+$/.test(id) || !p || typeof p.name !== 'string' || typeof p.system !== 'string')
      throw new Error(`Invalid persona: ${id}`)
    if (!p.name.trim() || !p.system.trim()) throw new Error(`Empty persona: ${id}`)
    if (
      p.replyTo !== undefined &&
      (!Array.isArray(p.replyTo) || !p.replyTo.every((x) => typeof x === 'string'))
    )
      throw new Error(`Invalid replyTo: ${id}`)
    for (const key of ['noReply', 'stir'] as const)
      if (p[key] !== undefined && typeof p[key] !== 'boolean') throw new Error(`Invalid ${key}: ${id}`)
    for (const key of ['stirEveryMs', 'stirIdleMs'] as const)
      if (p[key] !== undefined && (!Number.isFinite(p[key]) || p[key]! <= 0))
        throw new Error(`Invalid ${key}: ${id}`)
  }
  for (const id of ['chair', 'aman', 'gwern', 'representer'])
    if (!data[id]) throw new Error(`Missing persona: ${id}`)
  return data
}

export function loadPersonas() {
  return parsePersonas(readFileSync(new URL('../../PEARS.md', import.meta.url), 'utf8'))
}
