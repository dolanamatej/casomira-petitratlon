import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeResults } from './results.ts'
import type { Crew, Event } from './types.ts'
import { race2024 } from './fixtures/race2024.ts'

const at = (hms: string) => `2024-10-05T${hms}Z`
let n = 0
const ev = (e: Pick<Event, 'startNumber' | 'discipline' | 'type'> & Partial<Event>): Event =>
  ({ id: `e${++n}`, timestamp: at('00:00:00'), deviceId: 'test', createdAt: at(`00:00:${String(n % 60).padStart(2, '0')}`), ...e })

function race2024Log() {
  const crews: Crew[] = race2024.map(r => ({ startNumber: r.startNumber, category: r.category, crewName: '', helmsman: '', club: '' }))
  const events = race2024.flatMap(({ startNumber, p5, c2 }) => [
    ev({ startNumber, discipline: 'P5', type: 'start', timestamp: at(p5[0]) }),
    ev({ startNumber, discipline: 'P5', type: 'finish', timestamp: at(p5[1]) }),
    ev({ startNumber, discipline: 'P5', type: 'wait', waitSeconds: p5[2] }),
    ev({ startNumber, discipline: 'C2', type: 'start', timestamp: at(c2[0]) }),
    ev({ startNumber, discipline: 'C2', type: 'finish', timestamp: at(c2[1]) }),
  ])
  return { crews, events }
}

test('2024 race gives the same times as the 2024 results sheet', () => {
  const { crews, events } = race2024Log()
  const rows = computeResults(crews, events).flatMap(c => c.rows)
  for (const r of race2024) {
    const row = rows.find(x => x.startNumber === r.startNumber)!
    assert.deepEqual({ p5: row.p5.seconds, c2: row.c2.seconds, total: row.total }, r.expected, `crew ${r.startNumber}`)
  }
})

test('2024 Vlčata are ranked as the organizers ranked them', () => {
  const { crews, events } = race2024Log()
  const vlcata = computeResults(crews, events).find(c => c.category === 'Vlčata')!
  const expected = race2024.filter(r => 'handRank' in r).map(r => [r.startNumber, r.handRank]).sort((a, b) => a[1] - b[1])
  assert.deepEqual(vlcata.rows.map(r => [r.startNumber, r.rank]), expected)
})

test('equal totals share a place, crews without both times go last unranked', () => {
  const crew = (startNumber: number): Crew => ({ startNumber, category: 'Skauti', crewName: '', helmsman: '', club: '' })
  const ride = (startNumber: number, p5Finish: string) => [
    ev({ startNumber, discipline: 'P5', type: 'start', timestamp: at('10:00:00') }),
    ev({ startNumber, discipline: 'P5', type: 'finish', timestamp: at(p5Finish) }),
    ev({ startNumber, discipline: 'C2', type: 'start', timestamp: at('12:00:00') }),
    ev({ startNumber, discipline: 'C2', type: 'finish', timestamp: at('12:15:00') }),
  ]
  const events = [
    ...ride(1, '10:30:00'), ...ride(2, '10:25:00'), ...ride(3, '10:30:00.400'), ...ride(4, '10:20:00'),
    ev({ startNumber: 4, discipline: 'C2', type: 'dnf' }),
    ev({ startNumber: 5, discipline: 'P5', type: 'start', timestamp: at('10:00:00') }), // still on course
  ]
  const [skauti] = computeResults([1, 2, 3, 4, 5].map(crew), events)
  assert.deepEqual(skauti.rows.map(r => [r.startNumber, r.rank, r.rankTo]), [
    [2, 1, 1], [1, 2, 3], [3, 2, 3], [4, undefined, undefined], [5, undefined, undefined], // 1., 2.–3., 2.–3. (0.4 s apart is the same second)
  ])
})
