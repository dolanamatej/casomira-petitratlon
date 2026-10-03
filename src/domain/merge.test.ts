import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeLogs } from './merge.ts'
import { computeResults } from './results.ts'
import type { Crew, Event } from './types.ts'

const at = (hms: string) => `2026-10-10T${hms}Z`
let n = 0
const ev = (e: Pick<Event, 'startNumber' | 'discipline' | 'type'> & Partial<Event>): Event =>
  ({ id: `e${++n}`, timestamp: at('00:00:00'), deviceId: 'test', createdAt: at('00:00:00'), ...e })
const crew = (startNumber: number, crewName = ''): Crew => ({ startNumber, category: 'OPEN', crewName, helmsman: '', club: '' })

test('P5 station log merged with C2 station log gives complete results, merging twice changes nothing', () => {
  const p5 = {
    crews: [crew(1), crew(99, 'extra crew added at P5')],
    events: [1, 99].flatMap(startNumber => [
      ev({ startNumber, discipline: 'P5', type: 'start', timestamp: at('10:00:00') }),
      ev({ startNumber, discipline: 'P5', type: 'finish', timestamp: at('10:30:00') }),
    ]),
  }
  const c2 = {
    crews: [crew(1), crew(99, 'extra crew added at C2')],
    events: [1, 99].flatMap(startNumber => [
      ev({ startNumber, discipline: 'C2', type: 'start', timestamp: at('11:00:00') }),
      ev({ startNumber, discipline: 'C2', type: 'finish', timestamp: at('11:15:00') }),
    ]),
  }
  const merged = mergeLogs(mergeLogs(p5, c2), c2)

  assert.equal(merged.crews.length, 2)
  assert.equal(merged.events.length, 8)
  const [open] = computeResults(merged.crews, merged.events)
  assert.deepEqual(open.rows.map(r => [r.startNumber, r.total]), [[1, 45 * 60], [99, 45 * 60]])
})
