import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatDuration, parseWait } from './time.ts'

test('wait from the card is read as m:ss, plain minutes, or empty for none', () => {
  assert.equal(parseWait('4:20'), 260)
  assert.equal(parseWait(' 2 '), 120)
  assert.equal(parseWait(''), 0)
  assert.equal(parseWait('4:75'), undefined)
  assert.equal(parseWait('abc'), undefined)
})

test('durations print as h:mm:ss like the 2024 sheet', () => {
  assert.equal(formatDuration(2072), '0:34:32')
  assert.equal(formatDuration(4139), '1:08:59')
})
