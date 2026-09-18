import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { DEVICE_NAMES } from '../src/data.ts'
import { ephemeralIdentity, loadIdentity, saveIdentity, sign, verify } from '../src/identity.ts'

const home = mkdtempSync(join(tmpdir(), 'feynman-'))

describe('identity', () => {
  after(() => rmSync(home, { recursive: true, force: true }))

  it('creates a keypair and device name on first load and returns the same afterwards', () => {
    const first = loadIdentity(home)
    assert.equal(first.id.length, 64)
    assert.ok(DEVICE_NAMES.includes(first.device))
    assert.equal(loadIdentity(home).id, first.id)
    assert.equal(loadIdentity(home).device, first.device)
  })

  it('persists a re-rolled device name', () => {
    saveIdentity(home, { device: 'Lemnos', username: 'yoyo' })
    assert.equal(loadIdentity(home).device, 'Lemnos')
    assert.equal(loadIdentity(home).username, 'yoyo')
  })

  it('signs and verifies; other keys and tampered bytes fail', () => {
    const me = loadIdentity(home)
    const sig = sign(me, 'receipt')
    assert.equal(verify(me.id, 'receipt', sig), true)
    assert.equal(verify(me.id, 'receipt!', sig), false)
    assert.equal(verify(ephemeralIdentity().id, 'receipt', sig), false)
    assert.equal(verify('not hex', 'receipt', sig), false)
  })

  it('refuses a corrupt identity file instead of replacing it', () => {
    const bad = mkdtempSync(join(tmpdir(), 'feynman-bad-'))
    writeFileSync(join(bad, 'identity.json'), '{"seed":"short"}')
    assert.throws(() => loadIdentity(bad), /32-byte hex seed/)
    rmSync(bad, { recursive: true, force: true })
  })
})
