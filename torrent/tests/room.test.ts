import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import {
  flagString,
  openRoom,
  parseFlags,
  peerId,
  readLines,
  sleep,
  writeAll,
  type Room,
} from '../src/room.ts'
import { isTrustedAddress } from '../src/transport.ts'

const PORTS: [number, number] = [7300, 7303]
const opened: Room[] = []
const open = (room: string) => {
  const r = openRoom(room, { transport: 'local', ports: PORTS })
  opened.push(r)
  return r
}

describe('flags', () => {
  it('parses flags, booleans and positionals; skips the "--" pnpm forwards', () => {
    const f = parseFlags(['--', 'hello there', '--room', 'lab', '--join', '3'], ['join'])
    assert.deepEqual(f.positional, ['hello there', '3'])
    assert.equal(flagString(f, 'room', 'pears'), 'lab')
    assert.equal(f.opts.join, true)
    assert.equal(flagString(f, 'missing', 'dflt'), 'dflt')
  })
})

describe('transport', () => {
  it('trusts loopback and tailnet addresses only', () => {
    for (const ok of [
      '127.0.0.1',
      '::1',
      '::ffff:127.0.0.1',
      '100.64.0.1',
      '100.127.255.9',
      'fd7a:115c:a1e0::1',
    ])
      assert.equal(isTrustedAddress(ok), true, ok)
    for (const bad of [undefined, '', '10.0.0.1', '100.128.0.1', '100.63.9.9', '192.168.1.2', '2001:db8::1'])
      assert.equal(isTrustedAddress(bad), false, String(bad))
  })
})

describe('room over loopback', () => {
  after(async () => {
    for (const r of opened) await r.close()
  })

  it('two pears find each other, dedupe crossed dials and exchange a line', async () => {
    const a = open('t')
    await a.ready()
    const b = open('t')
    const seen: string[] = []
    b.on('connection', (s) => readLines(s, (l) => seen.push(l)))
    await b.ready()
    await a.refresh() // a dials b too: the crossed connection must be culled
    await sleep(200)
    assert.equal(a.connections.size, 1)
    assert.equal(b.connections.size, 1)
    assert.equal(peerId([...b.connections][0]), a.id)
    writeAll(a.connections, '[a] hi\n')
    await sleep(100)
    assert.deepEqual(seen, ['[a] hi'])
  })

  it('ignores pears in another room', async () => {
    const c = open('other')
    await c.ready()
    await sleep(100)
    assert.equal(c.connections.size, 0)
  })
})
