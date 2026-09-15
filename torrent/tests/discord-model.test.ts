import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openRouter } from '../src/discord/model.ts'

test('model adapter caps output, meters reported usage and supports abort', async (t) => {
  const records: object[] = []
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string)
    assert.equal(body.max_tokens, 1200)
    assert.equal(body.messages[0].role, 'system')
    assert.ok(init.signal instanceof AbortSignal)
    return new Response(
      JSON.stringify({
        id: 'gen-1',
        choices: [{ message: { content: 'hello' } }],
        usage: { total_tokens: 32, cost: 0.02 },
      }),
    )
  })
  const complete = openRouter('test-key', 'test-model', (data) => records.push(data))
  const answer = await complete(
    'system',
    [{ role: 'user', content: 'question' }],
    new AbortController().signal,
  )
  assert.deepEqual(answer, { text: 'hello', tokens: 32, cost: 0.02 })
  assert.equal(records.length, 1)
})

test('unreported cost stays unknown and HTTP errors do not echo response bodies', async (t) => {
  const fetch = t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'hello' } }],
        }),
      ),
  )
  const complete = openRouter('test-key', 'test-model', () => {})
  const answer = await complete('system', [], new AbortController().signal)
  assert.equal(answer.cost, null)
  fetch.mock.mockImplementation(async () => new Response('sensitive provider body', { status: 401 }))
  await assert.rejects(complete('system', [], new AbortController().signal), {
    message: 'OpenRouter HTTP 401',
  })
})
