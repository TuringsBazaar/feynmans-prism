import type { Chat } from './store.ts'

export interface Completion {
  text: string
  tokens: number
  cost: number | null
}
export type Complete = (system: string, messages: Chat[], signal: AbortSignal) => Promise<Completion>
interface Response {
  id?: string
  choices?: { message?: { content?: string } }[]
  usage?: { cost?: number; total_tokens?: number }
}

export function openRouter(key: string, model: string, record: (usage: object) => void): Complete {
  return async (system, messages, signal) => {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Title': 'pears-discord',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: 1200,
        temperature: 0.4,
      }),
    })
    if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`)
    const data = (await res.json()) as Response
    const cost = typeof data.usage?.cost === 'number' ? data.usage.cost : null
    const tokens = data.usage?.total_tokens ?? 0
    record({ model, generation: data.id, tokens, cost, usage: data.usage ?? null })
    const text = data.choices?.[0]?.message?.content
    if (typeof text !== 'string' || !text.trim()) throw new Error('OpenRouter returned no text')
    return { text: text.trim(), tokens, cost }
  }
}
