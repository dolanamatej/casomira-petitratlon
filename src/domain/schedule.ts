import { CATEGORIES, type Crew, type Discipline } from './types.ts'

export interface ScheduleParams {
  firstStart: string // "HH:MM"
  intervalMinutes: number
}

// 2024 rides in minutes; median drives the boats-on-course estimate, max the end estimate
export const RIDE_MINUTES: Record<Discipline, { typical: number; longest: number }> = {
  P5: { typical: 31, longest: 47 },
  C2: { typical: 14, longest: 22 },
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const toHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** Preview for the schedule form: what an interval means for n crews. */
export function scheduleStats(n: number, { firstStart, intervalMinutes }: ScheduleParams) {
  const last = toMinutes(firstStart) + (n - 1) * intervalMinutes
  // a crew's two slots are ceil(n/2) or floor(n/2) slots apart
  return {
    lastStart: toHHMM(last),
    estimatedEnd: toHHMM(last + Math.max(RIDE_MINUTES.P5.longest, RIDE_MINUTES.C2.longest)),
    pauseMinutes: { min: Math.floor(n / 2) * intervalMinutes, max: Math.ceil(n / 2) * intervalMinutes },
    typicalOnCourse: {
      P5: RIDE_MINUTES.P5.typical / intervalMinutes,
      C2: RIDE_MINUTES.C2.typical / intervalMinutes,
    },
  }
}

/** Registered crews in P5 start order, with planned starts on both stations. */
export function generateSchedule(crews: Crew[], { firstStart, intervalMinutes }: ScheduleParams): Crew[] {
  const ordered = crews
    .filter(c => c.startNumber !== undefined)
    .sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.startNumber! - b.startNumber!)
  const n = ordered.length
  const slot = (i: number) => toHHMM(toMinutes(firstStart) + i * intervalMinutes)
  return ordered.map((crew, i) => ({
    ...crew,
    plannedStartP5: slot(i),
    plannedStartC2: slot((i + Math.ceil(n / 2)) % n),
  }))
}
