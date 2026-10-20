import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateSchedule, crewClashes, scheduleStats } from './schedule.ts'
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

test('categories are mixed evenly, C2 is shifted by half the slots; unregistered crews are left out', () => {
  const crew = (startNumber: number | undefined, category: Crew['category']): Crew =>
    ({ startNumber, category, crewName: '', helmsman: '', club: '' })
  const crews = [crew(1, 'Vlčata'), crew(2, 'Skauti'), crew(3, 'Žabičky'), crew(4, 'OPEN'), crew(5, 'Vlčata'), crew(undefined, 'Skauti')]

  const planned = generateSchedule(crews, { firstStart: '10:30', intervalMinutes: 8 })
    .map(c => [c.startNumber, c.plannedStartP5, c.plannedStartC2])

  // worked by hand: Vlčata at 1/4 and 3/4, the rest at 1/2 slowest first; 5 slots, shift ceil(5/2) = 3
  assert.deepEqual(planned, [
    [1, '10:30', '10:54'],
    [3, '10:38', '11:02'],
    [2, '10:46', '10:30'],
    [4, '10:54', '10:38'],
    [5, '11:02', '10:46'],
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
  assert.deepEqual(crewClashes(crews), [{ helmsman: 'Krab', startNumbers: [1, 2], shortMinutes: 7 }])
})

test('crews sharing members are flagged both ways, without a helmsman name', () => {
  const crew = (startNumber: number, sharesWith: string, p5: string): Crew =>
    ({ startNumber, category: 'OPEN', crewName: '', helmsman: '', club: '', sharesWith, plannedStartP5: p5 })
  assert.deepEqual(crewClashes([crew(1, '', '10:30'), crew(2, '1', '10:40')]), [{ helmsman: undefined, startNumbers: [1, 2], shortMinutes: 37 }])
})

test('generated schedule resolves helmsman and shared-member clashes on its own', () => {
  const crews: Crew[] = Array.from({ length: 24 }, (_, i) =>
    ({ startNumber: i + 1, category: 'OPEN', crewName: '', helmsman: `H${i + 1}`, club: '' }))
  crews[1].helmsman = 'H1' // 1 and 2 would start back to back
  crews[2].sharesWith = '4, 5'
  const params = { firstStart: '10:30', intervalMinutes: 8 }
  assert.ok(crewClashes(generateSchedule(crews, params, crews.map(c => c.startNumber!))).length > 0)
  assert.deepEqual(crewClashes(generateSchedule(crews, params)), [])
})

test('priority crews start P5 as early as their clashes allow', () => {
  const crews: Crew[] = Array.from({ length: 24 }, (_, i) =>
    ({ startNumber: i + 1, category: 'OPEN', crewName: '', helmsman: `H${i + 1}`, club: '', priority: i >= 20 }))
  crews[21].helmsman = 'H21' // 21 and 22 share a helmsman, both priority
  crews[22].sharesWith = '21' // and 23 shares members with 21
  const planned = generateSchedule(crews, { firstStart: '10:30', intervalMinutes: 8 })
  // 24 clashes with nobody and goes right away; 21 rides P5 10:30–11:17 and C2 12:06–12:28, so 22 gets the first free
  // slot after its P5 (C2 then 12:54); 23 shares members with 21 and must also miss 21's C2 with its own P5 and
  // 21's P5 with its own C2: the first such slot is 12:54 (C2 11:18)
  assert.deepEqual(planned.filter(c => c.priority).map(c => [c.startNumber, c.plannedStartP5]),
    [[21, '10:30'], [24, '10:38'], [22, '11:18'], [23, '12:54']])
  assert.deepEqual(crewClashes(planned), [])
})
