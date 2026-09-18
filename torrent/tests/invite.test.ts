import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Headscale } from '../src/headscale.ts'
import { formatInvite, loginServer, parseInvite } from '../src/invite.ts'

const inviter = 'ab'.repeat(32)

interface Call {
  method: string
  path: string
  body: unknown
}

// A Headscale that knows no users, creates "yoyo" as id 7, and mints "pak".
function fakeHeadscale(calls: Call[]): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input).replace('https://hs.test', '')
    calls.push({
      method: init?.method ?? 'GET',
      path,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer k')
    if (path.startsWith('/api/v1/user?name=')) return Response.json({ users: [] })
    if (path === '/api/v1/user') return Response.json({ user: { id: '7', name: 'yoyo' } })
    if (path === '/api/v1/preauthkey') return Response.json({ preAuthKey: { key: 'pak' } })
    return new Response('secret body', { status: 500 })
  }) as typeof fetch
}

describe('invite codes', () => {
  it('round-trip and reject malformed codes', () => {
    const code = formatInvite({ host: 'adiabatic.garden', inviter, key: 'hskey123' })
    assert.equal(code, `feynman:adiabatic.garden:${inviter}:hskey123`)
    assert.deepEqual(parseInvite(` ${code}\n`), { host: 'adiabatic.garden', inviter, key: 'hskey123' })
    assert.equal(loginServer('adiabatic.garden'), 'https://adiabatic.garden')
    const bad = ['', 'feynman:host:short:key', `x:h:${inviter}:k`, `feynman:h:${inviter}:`, 'feynman:a:b']
    for (const b of bad) assert.equal(parseInvite(b), null, b)
  })
})

describe('headscale client', () => {
  it('finds or creates the user and mints a single-use key', async () => {
    const calls: Call[] = []
    const hs = new Headscale('https://hs.test/', 'k', fakeHeadscale(calls))
    assert.equal(await hs.createPreAuthKey(await hs.userId('yoyo'), 2), 'pak')
    assert.deepEqual(
      calls.map((c) => [c.method, c.path]),
      [
        ['GET', '/api/v1/user?name=yoyo'],
        ['POST', '/api/v1/user'],
        ['POST', '/api/v1/preauthkey'],
      ],
    )
    const key = calls[2].body as { user: string; reusable: boolean; ephemeral: boolean; expiration: string }
    assert.equal(key.user, '7')
    assert.equal(key.reusable, false)
    assert.equal(key.ephemeral, false)
    assert.ok(Date.parse(key.expiration) > Date.now() + 3_600_000)
  })

  it('reports HTTP errors by status only, never the body', async () => {
    const hs = new Headscale('https://hs.test', 'k', fakeHeadscale([]))
    await assert.rejects(hs['call']('GET', '/nope'), (err: Error) => {
      assert.match(err.message, /HTTP 500/)
      assert.doesNotMatch(err.message, /secret/)
      return true
    })
  })
})
