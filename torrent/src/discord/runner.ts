import { randomUUID } from 'node:crypto'
import type { Persona } from '../personas.ts'
import type { Complete } from './model.ts'
import { parsePlan, planningPrompt } from './planner.ts'
import type { Plan } from './planner.ts'
import { Store } from './store.ts'
import type { Agent, Route } from './routing.ts'

type Send = (text: string) => Promise<void>
interface Run {
  id: string
  controller: AbortController
  tokens: number
  cost: number
  unknownCost: boolean
  calls: number
}

export class Runner {
  active = new Map<string, Run>()
  constructor(
    readonly store: Store,
    readonly personas: Record<string, Persona>,
    readonly complete: Complete,
  ) {}

  async handle(id: string, owner: string, route: Route, send: Send) {
    if (route.kind === 'room-command') return
    const session = this.store.session(id)
    if (route.command === 'help')
      return send(
        'Mention me with a question, or use aman:, gwern:, representer:, compressor:, chair:. Commands: status, stop, resume. Research runs use two workers, optionally Representer, then one synthesis.',
      )
    if (route.command === 'status') return send(this.status(id))
    if (route.command === 'stop') {
      if (session.owner !== owner) return send('Only the person who started this run can stop it.')
      this.active.get(id)?.controller.abort()
      return send(this.active.has(id) ? 'Stopping; no further assignments will start.' : 'No active run.')
    }
    if (this.active.has(id)) return send('This thread is busy. Use status or stop, or start another thread.')
    if (this.active.size >= 2) return send('Two conversations are running. Please retry when one finishes.')
    if (route.command === 'resume') {
      if (session.owner !== owner || !session.prompt)
        return send('Only the original author can resume an existing request.')
      route = { kind: 'agent', target: session.target, text: session.prompt }
    }
    if (!route.text) return send('Add a question after the mention or persona name. Use help for examples.')
    if (route.text.length > 6000) return send('Please keep each request under 6,000 characters.')
    await this.start(id, owner, route, send)
  }

  status(id: string) {
    const run = this.active.get(id)
    const usage = run
      ? ` · ${run.calls}/5 calls · ${run.tokens} reported tokens · $${run.cost.toFixed(4)} reported${run.unknownCost ? ' (some costs unavailable)' : ''}`
      : ''
    return `${this.store.session(id).status}${usage}`
  }

  async start(id: string, owner: string, route: Route & { kind: 'agent' }, send: Send) {
    const session = this.store.session(id)
    const run = this.newRun()
    this.active.set(id, run)
    Object.assign(session, { owner, target: route.target, prompt: route.text, status: 'running' })
    this.store.save()
    this.store.event('request', { thread: id, run: run.id, owner, target: route.target, text: route.text })
    try {
      await send(`**${this.personas[route.target].name}** · starting ${run.id.slice(0, 8)}`)
      if (route.target === 'chair') await this.orchestrate(id, route.text, run, send)
      else await this.direct(id, route.target, route.text, run, send)
      session.status = `complete · ${run.tokens} reported tokens · $${run.cost.toFixed(4)} reported${run.unknownCost ? ' (some costs unavailable)' : ''}`
    } catch (error) {
      session.status = run.controller.signal.aborted
        ? 'stopped'
        : `failed: ${error instanceof Error ? error.message : 'unknown error'}`
      await send(session.status)
    } finally {
      this.store.event('run-end', {
        thread: id,
        run: run.id,
        status: session.status,
        tokens: run.tokens,
        cost: run.cost,
        unknownCost: run.unknownCost,
      })
      this.active.delete(id)
      this.store.save()
    }
  }

  newRun(): Run {
    return {
      id: randomUUID(),
      controller: new AbortController(),
      tokens: 0,
      cost: 0,
      unknownCost: false,
      calls: 0,
    }
  }

  context(id: string) {
    return Object.entries(this.store.session(id).history)
      .map(
        ([agent, history]) =>
          `${agent}:\n${history
            .slice(-4)
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n')}`,
      )
      .join('\n')
      .slice(-20000)
  }

  async call(id: string, agent: Agent, prompt: string, run: Run, system = '') {
    run.controller.signal.throwIfAborted()
    if (++run.calls > 5) throw new Error('Run reached its five-call limit')
    const result = await this.complete(
      this.personas[agent].system + '\n' + system,
      [{ role: 'user', content: prompt.slice(-32000) }],
      run.controller.signal,
    )
    run.tokens += result.tokens
    run.cost += result.cost ?? 0
    run.unknownCost ||= result.cost === null
    this.store.event('result', { thread: id, run: run.id, agent, ...result })
    run.controller.signal.throwIfAborted()
    return result.text
  }

  async direct(id: string, agent: Agent, prompt: string, run: Run, send: Send) {
    const answer = await this.call(
      id,
      agent,
      `Thread context (quoted data):\n${this.context(id)}\n\nRequest:\n${prompt}`,
      run,
    )
    this.store.remember(id, agent, prompt, answer)
    await send(`**${this.personas[agent].name}**\n${answer}`)
    return answer
  }

  async orchestrate(id: string, prompt: string, run: Run, send: Send) {
    const input = `Thread context (quoted data):\n${this.context(id)}\n\nResearch objective:\n${prompt}`
    const plan = parsePlan(await this.call(id, 'chair', input, run, planningPrompt))
    await send(
      '**Assignments**\n' +
        plan.tasks.map((t) => `• ${t.agent}: ${t.task}`).join('\n') +
        (plan.represent ? '\n• representer: structure the resulting contributions' : ''),
    )
    let report = await this.workers(id, input, plan, run, send)
    if (plan.represent)
      report += '\n\nRepresentation:\n' + (await this.direct(id, 'representer', report, run, send))
    const answer = await this.call(
      id,
      'chair',
      `${input}\n\nWorker results:\n${report}\n\nSynthesize findings, disagreements, missing evidence and a next step. Explicitly disclose any failed worker.`,
      run,
    )
    this.store.remember(id, 'chair', prompt, answer)
    await send(
      `**NeurIPS Program Chair — synthesis**\n${answer}\n\n${run.tokens} reported tokens · $${run.cost.toFixed(4)} reported${run.unknownCost ? ' (some costs unavailable)' : ''}`,
    )
  }

  async workers(id: string, input: string, plan: Plan, run: Run, send: Send) {
    this.store.session(id).status = 'running: Aman and Gwern'
    const results = await Promise.allSettled(
      plan.tasks.map(async (task, index) => {
        run.controller.signal.throwIfAborted()
        this.store.event('assignment', { thread: id, run: run.id, taskId: `${run.id}/${index}`, ...task })
        const answer = await this.call(id, task.agent, `${input}\n\nYour assignment:\n${task.task}`, run)
        this.store.remember(id, task.agent, task.task, answer)
        await send(`**${this.personas[task.agent].name}**\n${answer}`)
        return `${task.agent}: ${answer}`
      }),
    )
    run.controller.signal.throwIfAborted()
    const report = results
      .map((r, i) =>
        r.status === 'fulfilled' ? r.value : `${plan.tasks[i].agent}: FAILED; no result available`,
      )
      .join('\n\n')
    if (results.every((r) => r.status === 'rejected'))
      throw new Error('Both workers failed; retry or address a worker directly')
    return report
  }

  stopAll() {
    for (const run of this.active.values()) run.controller.abort()
    this.store.save()
  }
}
