import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateSchedule, scheduleStats } from './schedule.ts'
import type { Crew } from './types.ts'

// worked examples from the specification, 27 crews from 10:30
test('27 crews every 8 minutes: last start 13:58, 104–112 minutes between disciplines', () => {
  const s = scheduleStats(27, { firstStart: '10:30', intervalMinutes: 8 })
  assert.equal(s.lastStart, '13:58')
  assert.equal(s.estimatedEnd, '14:45') // + longest 2024 P5 ride, 47 min
  assert.deepEqual(s.pauseMinutes, { min: 104, max: 112 })
  assert.equal(s.typicalOnCourse.P5.toFixed(1), '3.9') // 2024 median P5 ride 31 min
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
