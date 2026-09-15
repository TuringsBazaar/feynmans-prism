import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { flagString, parseFlags, topicFor } from '../src/room.ts'

describe('room', () => {
  it('parses flags, booleans and positionals; skips the "--" pnpm forwards', () => {
    const f = parseFlags(['--', 'hello there', '--room', 'lab', '--join', '3'], ['join'])
    assert.deepEqual(f.positional, ['hello there', '3'])
    assert.equal(flagString(f, 'room', 'pears'), 'lab')
    assert.equal(f.opts.join, true)
    assert.equal(flagString(f, 'missing', 'dflt'), 'dflt')
  })

  it('derives a stable 32-byte topic from the room name', () => {
    assert.equal(topicFor('pears').length, 32)
    assert.deepEqual(topicFor('pears'), topicFor('pears'))
    assert.notDeepEqual(topicFor('pears'), topicFor('lab'))
  })
})
