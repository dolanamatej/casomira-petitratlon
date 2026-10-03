import { test } from 'node:test'
import assert from 'node:assert/strict'
import { casovkaCells, crewsToSend, mergeRemote, snapshotOf } from './sync.ts'
import type { Crew, Event } from './types.ts'

const crew = (startNumber: number, crewName: string, extra: Partial<Crew> = {}): Crew =>
  ({ startNumber, category: 'Vlčata', crewName, helmsman: '', club: '', ...extra })

test('only crews changed since the last send are sent', () => {
  const sent = [crew(1, 'Bobři'), crew(2, 'Vydry')]
  const snapshot = snapshotOf(sent)
  const now = [crew(1, 'Bobři'), crew(2, 'Vydry', { plannedStartP5: '10:30' }), crew(3, 'Navíc'), { ...crew(4, ''), startNumber: undefined }]
  assert.deepEqual(crewsToSend(now, snapshot).map(c => c.startNumber), [2, 3])
})

test('downloaded crews win, except ones this notebook changed and has not sent yet', () => {
  const local = { crews: [crew(1, 'Bobři'), crew(2, 'Vydry upraveno'), crew(5, 'Jen tady')], events: [] }
  const snapshot = snapshotOf([crew(1, 'Bobři'), crew(2, 'Vydry')])
  const remote = { crews: [crew(1, 'Bobři', { plannedStartP5: '10:30' }), crew(2, 'Vydry'), crew(3, 'Z hlavního')], events: [] }

  const merged = mergeRemote(local, remote, snapshot)
  assert.deepEqual(merged.crews.map(c => [c.startNumber, c.crewName, c.plannedStartP5]), [
    [1, 'Bobři', '10:30'], [2, 'Vydry upraveno', undefined], [5, 'Jen tady', undefined], [3, 'Z hlavního', undefined],
  ])
  // crew 2 stays unsent, the rest now match the sheet
  assert.deepEqual(crewsToSend(merged.crews, merged.snapshot).map(c => c.startNumber), [2, 5])
})

test('časovka cells follow the discipline of each touched event, in 24-hour local time', () => {
  const ev = (e: Partial<Event> & Pick<Event, 'id' | 'type'>): Event =>
    ({ startNumber: 7, discipline: 'P5', timestamp: '', deviceId: 'd', createdAt: e.id, ...e })
  const t = (h: number, m: number, s: number) => new Date(2026, 9, 10, h, m, s).toISOString()
  const events = [
    ev({ id: '1', type: 'start', timestamp: t(10, 30, 5) }),
    ev({ id: '2', type: 'finish', timestamp: t(11, 2, 0) }),
    ev({ id: '3', type: 'wait', waitSeconds: 260 }),
    ev({ id: '4', type: 'start', startNumber: 8, timestamp: t(10, 38, 0) }),
    ev({ id: '5', type: 'dnf', startNumber: 8 }),
    ev({ id: '6', type: 'start', startNumber: 8, discipline: 'C2', timestamp: t(12, 0, 0) }),
  ]
  const crews = [crew(7, 'A'), crew(8, 'B')]
  // the station was switched to P5 before the C2 event went out: its cells must still be sent
  assert.deepEqual(casovkaCells(events, crews, [events[1], events[4], events[5]]), [
    { startNumber: 7, category: 'Vlčata', discipline: 'P5', cells: { start: '10:30:05', finish: '11:02:00', wait: '0:04:20' } },
    { startNumber: 8, category: 'Vlčata', discipline: 'P5', cells: { start: '10:38:00', finish: 'DNF', wait: '0:00:00' } },
    { startNumber: 8, category: 'Vlčata', discipline: 'C2', cells: { start: '12:00:00', finish: '' } },
  ])
})
