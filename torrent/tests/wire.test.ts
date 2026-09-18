import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CONTROL_PREFIX, encodeChat, encodeControl, isControl, parseChat, parseControl } from '../src/wire.ts'

describe('wire', () => {
  it('round-trips a control message with the sigil', () => {
    const line = encodeControl({ t: 'join', name: 'aman', problemId: 'credit-assignment' })
    assert.ok(line.startsWith(CONTROL_PREFIX))
    assert.ok(line.endsWith('\n'))
    assert.ok(isControl(line))
    assert.deepEqual(parseControl(line.trimEnd()), {
      t: 'join',
      name: 'aman',
      problemId: 'credit-assignment',
    })
  })

  it('accepts bare JSON control lines from older clients', () => {
    assert.deepEqual(parseControl('{"t":"rename","name":"Diana"}'), { t: 'rename', name: 'Diana' })
  })

  it('treats non-JSON and JSON without t as chat', () => {
    assert.equal(parseControl('[aman] hello'), null)
    assert.equal(parseControl('{"x":1}'), null)
    assert.equal(parseControl(CONTROL_PREFIX + 'not json'), null)
  })

  it('parses tagged and untagged chat, dropping blanks', () => {
    assert.equal(encodeChat('lucy', 'hi'), '[lucy] hi\n')
    assert.deepEqual(parseChat('[lucy] hi there'), { from: 'lucy', text: 'hi there' })
    assert.deepEqual(parseChat('  raw line '), { from: null, text: 'raw line' })
    assert.equal(parseChat('   '), null)
  })
})
