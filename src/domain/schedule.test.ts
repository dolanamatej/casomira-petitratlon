import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateSchedule, helmsmanClashes, scheduleStats } from './schedule.ts'
import type { Crew } from './types.ts'

// worked examples from the specification, 27 crews from 10:30
test('27 crews every 8 minutes: last start 13:58, 104–112 minutes between disciplines', () => {
  const s = scheduleStats(27, { firstStart: '10:30', intervalMinutes: 8 })
  assert.equal(s.lastStart, '13:58')
  assert.equal(s.estimatedEnd, '14:45') // + longest 2024 P5 ride, 47 min
  assert.deepEqual(s.pauseMinutes, { min: 104, max: 112 })
  assert.equal(s.typicalOnCourse.P5.toFixed(1), '3.9') // 2024 median P5 ride 31 min
  // P5-first crews: 14 slots (112 min) minus longest P5 47 = 65; C2-first: 104 − 22 = 82
  assert.equal(s.minRestMinutes, 65)
})

test('27 crews every 7 minutes: last start 13:32, 91–98 minutes between disciplines', () => {
  const s = scheduleStats(27, { firstStart: '10:30', intervalMinutes: 7 })
  assert.equal(s.lastStart, '13:32')
  assert.deepEqual(s.pauseMinutes, { min: 91, max: 98 })
})

test('P5 goes from the slowest category, C2 is shifted by half the slots; unregistered crews are left out', () => {
  const crew = (startNumber: number | undefined, category: Crew['category']): Crew =>
    ({ startNumber, category, crewName: '', helmsman: '', club: '' })
  const crews = [crew(1, 'Vlčata'), crew(2, 'Skauti'), crew(3, 'Žabičky'), crew(4, 'OPEN'), crew(5, 'Vlčata'), crew(undefined, 'Skauti')]

  const planned = generateSchedule(crews, { firstStart: '10:30', intervalMinutes: 8 })
    .map(c => [c.startNumber, c.plannedStartP5, c.plannedStartC2])

  // worked by hand: 5 slots, shift ceil(5/2) = 3
  assert.deepEqual(planned, [
    [3, '10:30', '10:54'],
    [1, '10:38', '11:02'],
    [5, '10:46', '10:30'],
    [2, '10:54', '10:38'],
    [4, '11:02', '10:46'],
  ])
})

test('explicit P5 order is kept, crews missing from it follow in default order', () => {
  const crew = (startNumber: number, category: Crew['category']): Crew => ({ startNumber, category, crewName: '', helmsman: '', club: '' })
  const crews = [crew(1, 'Vlčata'), crew(2, 'Žabičky'), crew(3, 'Skauti')]
  const planned = generateSchedule(crews, { firstStart: '10:30', intervalMinutes: 8 }, [3, 1])
  assert.deepEqual(planned.map(c => [c.startNumber, c.plannedStartP5]), [[3, '10:30'], [1, '10:38'], [2, '10:46']])
})

test('helmsman steering two crews is flagged when the rides can overlap', () => {
  const crew = (startNumber: number, helmsman: string, p5: string, c2: string): Crew =>
    ({ startNumber, category: 'OPEN', crewName: '', helmsman, club: '', plannedStartP5: p5, plannedStartC2: c2 })
  const crews = [
    crew(1, 'Krab', '10:30', '12:22'),
    crew(2, ' krab', '11:10', '13:00'), // P5 at 11:10 while crew 1's P5 (10:30 + 47 min) may still be out
    crew(3, 'Filip', '10:30', '12:22'),
    crew(4, 'Filip', '11:30', '13:30'), // 11:30 is after 10:30 + 47 min, 13:30 after 12:22 + 22 min
  ]
  assert.deepEqual(helmsmanClashes(crews), [{ helmsman: 'Krab', startNumbers: [1, 2], shortMinutes: 7 }])
})
