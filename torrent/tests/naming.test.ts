import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEVICE_NAMES } from '../src/data.ts'
import { pickDeviceName } from '../src/identity.ts'
import { pickCoordinator } from '../src/naming.ts'

const first = () => 0
const last = () => 0.999

describe('device names', () => {
  it('picks a random free name from the DESIGN.md list', () => {
    assert.equal(pickDeviceName([], first), 'Nonacris')
    assert.equal(pickDeviceName(['Nonacris'], first), 'Eridanus')
    assert.equal(pickDeviceName([], last), 'Tyrrhenian')
    for (let i = 0; i < 50; i++) {
      const n = pickDeviceName(['Diana'])
      assert.ok(DEVICE_NAMES.includes(n) && n !== 'Diana', n)
    }
  })

  it('suffixes a name once all nineteen are in use', () => {
    assert.equal(pickDeviceName(DEVICE_NAMES, first), 'Nonacris-2')
    assert.equal(pickDeviceName([...DEVICE_NAMES, 'Nonacris-2'], first), 'Nonacris-3')
  })
})

describe('election', () => {
  it('elects the earliest start, ties broken by id, identically on every pear', () => {
    const a = { id: 'aaaa', since: 30 }
    const b = { id: 'bbbb', since: 10 }
    const c = { id: 'cccc', since: 20 }
    assert.equal(pickCoordinator(a, [b, c]), 'bbbb')
    assert.equal(pickCoordinator(b, [a, c]), null) // b sees itself win
    assert.equal(pickCoordinator({ id: 'zzzz', since: 5 }, [{ id: 'yyyy', since: 5 }]), 'yyyy')
  })
})
