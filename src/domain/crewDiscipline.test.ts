import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crewDiscipline } from './crewDiscipline.ts'
import type { Event } from './types.ts'

let n = 0
const ev = (e: Partial<Event> & Pick<Event, 'type'>): Event => ({
  id: `e${++n}`, startNumber: 7, discipline: 'P5', timestamp: '2026-10-10T10:30:00Z',
  deviceId: 'test', createdAt: '2026-10-10T10:30:00Z', ...e,
})

test('voided start leaves the crew waiting', () => {
  const start = ev({ type: 'start' })
  const state = crewDiscipline([start, ev({ type: 'void', voidsEventId: start.id })], 7, 'P5')
  assert.equal(state.status, 'waiting')
})

test('corrected start wins over the original, whatever the log order', () => {
  const original = ev({ type: 'start', timestamp: '2026-10-10T10:30:05Z', createdAt: '2026-10-10T10:30:05Z' })
  const correction = ev({ type: 'start', timestamp: '2026-10-10T10:30:00Z', createdAt: '2026-10-10T10:41:00Z' })
  const state = crewDiscipline([correction, original], 7, 'P5')
  assert.equal(state.start?.timestamp, '2026-10-10T10:30:00Z')
})

test('finished crew gets finish − start − wait in seconds', () => {
  const state = crewDiscipline([
    ev({ type: 'start', timestamp: '2026-10-10T12:30:00Z' }),
    ev({ type: 'finish', timestamp: '2026-10-10T12:59:04Z' }),
    ev({ type: 'wait', waitSeconds: 260 }), // 0:04:20 from the card
  ], 7, 'P5')
  assert.equal(state.status, 'finished')
  assert.equal(state.seconds, 29 * 60 + 4 - 260) // 2024 Delfíni P5: 0:24:44
})

test('dnf takes the crew off the course until it is voided', () => {
  const dnf = ev({ type: 'dnf' })
  const events = [ev({ type: 'start' }), dnf]
  assert.equal(crewDiscipline(events, 7, 'P5').status, 'out')
  assert.equal(crewDiscipline([...events, ev({ type: 'void', voidsEventId: dnf.id })], 7, 'P5').status, 'onCourse')
})
