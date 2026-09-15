import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { TestContext } from 'node:test'
import { loadPersonas, parsePersonas } from '../src/personas.ts'
import { routeMessage, chunks } from '../src/discord/routing.ts'
import { parsePlan } from '../src/discord/planner.ts'
import { Store } from '../src/discord/store.ts'
import { Runner } from '../src/discord/runner.ts'
import type { Complete } from '../src/discord/model.ts'
import { config } from '../src/discord/config.ts'

const plan = JSON.stringify({
  tasks: [
    { agent: 'aman', task: 'derive a model' },
    { agent: 'gwern', task: 'challenge assumptions' },
  ],
  represent: true,
})
const result = (text: string) => ({ text, tokens: 20, cost: 0.001 })

function fixture(t: TestContext, complete: Complete) {
  const directory = mkdtempSync(join(tmpdir(), 'pears-discord-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const store = new Store(directory)
  return { store, runner: new Runner(store, loadPersonas(), complete) }
}

test('routing supports aliases, sticky targets, controls and exact prefixes', () => {
  assert.deepEqual(routeMessage('<@123> Aman: explain x', '123'), {
    target: 'aman',
    text: 'explain x',
    command: undefined,
  })
  assert.equal(routeMessage('<@!123> why?', '123', 'gwern').target, 'gwern')
  assert.equal(routeMessage('noera: new problem', '123', 'aman').target, 'chair')
  assert.equal(routeMessage('chair: STOP', '123').command, 'stop')
  assert.equal(routeMessage('stopping time theorem', '123').command, undefined)
  assert.equal(chunks('x'.repeat(4001)).join('').length, 4001)
  assert.ok(chunks('x'.repeat(4001)).every((chunk) => chunk.length <= 1900))
})

test('persona and plan validation rejects malformed or unauthorized assignments', () => {
  assert.ok(loadPersonas().chair.name.includes('Program Chair'))
  assert.throws(() => parsePersonas('no JSON block'))
  assert.throws(() => parsePersonas('```json\n{}\n```'))
  assert.equal(parsePlan(plan).tasks.length, 2)
  assert.throws(() => parsePlan(plan.replace('gwern', 'aman')))
  assert.throws(() => parsePlan(plan.replace('gwern', 'shell')))
  assert.throws(() => config({}))
})

test('chair runs two workers, includes representation in synthesis, and persists context', async (t) => {
  const prompts: string[] = []
  const { store, runner } = fixture(t, async (_system, messages) => {
    prompts.push(messages[0].content)
    return result(prompts.length === 1 ? plan : `answer-${prompts.length}`)
  })
  const sent: string[] = []
  await runner.handle('thread', 'human', { target: 'chair', text: 'investigate X' }, async (x) => {
    sent.push(x)
  })
  assert.equal(prompts.length, 5)
  assert.match(prompts[4], /Representation:\nanswer-4/)
  assert.ok(sent.some((x) => x.startsWith('**Aman**')))
  assert.ok(sent.some((x) => x.includes('synthesis')))
  assert.match(store.session('thread').status, /complete.*100 reported tokens/)
  assert.equal(new Store(store.directory).session('thread').history.chair?.length, 2)
  assert.equal(runner.active.size, 0)
})

test('direct worker gets thread context without invoking the chair', async (t) => {
  let calls = 0
  const { store, runner } = fixture(t, async (system, messages) => {
    calls++
    assert.match(system, /empirical research persona/)
    assert.match(messages[0].content, /Aman hypothesis/)
    return result('critique')
  })
  store.remember('thread', 'aman', 'question', 'Aman hypothesis')
  await runner.handle('thread', 'human', { target: 'gwern', text: 'critique Aman' }, async () => {})
  assert.equal(calls, 1)
  assert.equal(store.session('thread').target, 'gwern')
  assert.equal(store.session('other').history.gwern, undefined)
})

test('stop aborts pending workers and prevents synthesis; only owner can stop', async (t) => {
  let calls = 0
  const { store, runner } = fixture(t, async (_system, _messages, signal) => {
    if (++calls === 1) return result(plan)
    return new Promise((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
    )
  })
  const sent: string[] = []
  const send = async (x: string) => {
    sent.push(x)
  }
  const running = runner.handle('thread', 'human', { target: 'chair', text: 'research' }, send)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(calls, 3)
  await runner.handle('thread', 'other', { target: 'chair', text: 'stop', command: 'stop' }, send)
  assert.ok(sent.some((x) => x.includes('Only the person')))
  await runner.handle('thread', 'human', { target: 'chair', text: 'stop', command: 'stop' }, send)
  await running
  assert.equal(calls, 3)
  assert.equal(store.session('thread').status, 'stopped')
  assert.ok(!sent.some((x) => x.includes('— synthesis')))
})

test('duplicate message IDs and interrupted runs survive restart', (t) => {
  const { store } = fixture(t, async () => result('unused'))
  assert.equal(store.claim('message-1'), true)
  assert.equal(store.claim('message-1'), false)
  store.session('thread').status = 'running: Aman and Gwern'
  store.save()
  const restored = new Store(store.directory)
  assert.equal(restored.claim('message-1'), false)
  assert.match(restored.session('thread').status, /^interrupted/)
})

test('a failed worker is disclosed in synthesis, and failed runs release the slot', async (t) => {
  let calls = 0
  const { store, runner } = fixture(t, async (system, messages) => {
    calls++
    if (calls === 1) return result(plan.replace('true', 'false'))
    if (system.includes('empirical research persona')) throw new Error('provider down')
    if (calls === 4) assert.match(messages[0].content, /gwern: FAILED/)
    return result('answer')
  })
  await runner.handle('thread', 'human', { target: 'chair', text: 'research' }, async () => {})
  assert.equal(calls, 4)
  assert.match(store.session('thread').status, /^complete/)
  await runner.handle('bad', 'human', { target: 'gwern', text: 'research' }, async () => {})
  assert.match(store.session('bad').status, /^failed/)
  assert.equal(runner.active.size, 0)
})
