import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Agent } from './routing.ts'

export type Chat = { role: 'user' | 'assistant'; content: string }
export interface Session {
  target: Agent
  history: Partial<Record<Agent, Chat[]>>
  owner: string
  prompt: string
  status: string
}

export class Store {
  sessions: Record<string, Session> = {}
  seen = new Set<string>()
  constructor(readonly directory: string) {
    mkdirSync(directory, { recursive: true })
    const file = join(directory, 'state.json')
    if (!existsSync(file)) return
    const saved = JSON.parse(readFileSync(file, 'utf8'))
    this.sessions = saved.sessions
    this.seen = new Set(saved.seen)
    for (const session of Object.values(this.sessions))
      if (session.status.startsWith('running')) session.status = 'interrupted; use resume to start a new run'
  }

  session(id: string): Session {
    return (this.sessions[id] ??= { target: 'chair', history: {}, owner: '', prompt: '', status: 'idle' })
  }

  claim(id: string) {
    if (this.seen.has(id)) return false
    this.seen.add(id)
    if (this.seen.size > 10000) this.seen.delete(this.seen.values().next().value!)
    this.save()
    return true
  }

  event(kind: string, data: object) {
    const at = new Date().toISOString()
    appendFileSync(
      join(this.directory, `${at.slice(0, 10)}.jsonl`),
      JSON.stringify({ at, kind, ...data }) + '\n',
    )
  }

  remember(id: string, agent: Agent, user: string, answer: string) {
    const session = this.session(id)
    const history = session.history[agent] ?? []
    session.history[agent] = [
      ...history,
      { role: 'user' as const, content: user },
      { role: 'assistant' as const, content: answer },
    ].slice(-12)
    this.save()
  }

  save() {
    const file = join(this.directory, 'state.json')
    writeFileSync(`${file}.tmp`, JSON.stringify({ sessions: this.sessions, seen: [...this.seen] }))
    renameSync(`${file}.tmp`, file)
  }
}
