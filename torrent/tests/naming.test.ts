import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PEAR_NAMES } from '../src/data.ts'
import { freeNameStack, nameRank, pickCoordinator, popFreeName } from '../src/naming.ts'

describe('naming', () => {
  it('ranks canonical names by position, unknown after, unnamed last', () => {
    assert.equal(nameRank('aman'), 0)
    assert.equal(nameRank('gwern'), PEAR_NAMES.length - 1)
    assert.equal(nameRank('zed'), PEAR_NAMES.length)
    assert.equal(nameRank(null), Number.POSITIVE_INFINITY)
  })

  it('pops the first free name in canonical order', () => {
    assert.equal(popFreeName([]), 'aman')
    assert.equal(popFreeName(['aman', 'guillefix']), 'alex')
    assert.deepEqual(freeNameStack(['aman']).slice(0, 2), ['guillefix', 'alex'])
  })

  it('suffixes the last name once the pool is exhausted', () => {
    assert.equal(popFreeName(PEAR_NAMES), 'gwern-1')
    assert.equal(popFreeName([...PEAR_NAMES, 'gwern-1']), 'gwern-2')
  })

  it('elects the lowest-ranked name, ties broken by id, identically on every pear', () => {
    const a = { id: 'aaaa', name: 'lucy' }
    const b = { id: 'bbbb', name: 'aman' }
    const c = { id: 'cccc', name: null }
    assert.equal(pickCoordinator(a, [b, c]), 'bbbb')
    assert.equal(pickCoordinator(b, [a, c]), null) // b sees itself win
    assert.equal(pickCoordinator({ id: 'zzzz', name: null }, [{ id: 'yyyy', name: null }]), 'yyyy')
  })
})
