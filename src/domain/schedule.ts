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
  // P5-first crews start C2 ceil(n/2) slots later, C2-first crews start P5 floor(n/2) slots later
  const p5FirstGap = Math.ceil(n / 2) * intervalMinutes
  const c2FirstGap = Math.floor(n / 2) * intervalMinutes
  return {
    lastStart: toHHMM(last),
    estimatedEnd: toHHMM(last + Math.max(RIDE_MINUTES.P5.longest, RIDE_MINUTES.C2.longest)),
    pauseMinutes: { min: c2FirstGap, max: p5FirstGap },
    /** Worst case rest between finishing the first ride and the second start. */
    minRestMinutes: Math.min(p5FirstGap - RIDE_MINUTES.P5.longest, c2FirstGap - RIDE_MINUTES.C2.longest),
    typicalOnCourse: {
      P5: RIDE_MINUTES.P5.typical / intervalMinutes,
      C2: RIDE_MINUTES.C2.typical / intervalMinutes,
    },
  }
}

/** Registered crews in P5 start order, with planned starts on both stations. */
export function generateSchedule(crews: Crew[], { firstStart, intervalMinutes }: ScheduleParams, order: number[] = []): Crew[] {
  // explicit order first, everyone else by category from the slowest, then by start number
  const rank = (c: Crew) => (order.includes(c.startNumber!) ? order.indexOf(c.startNumber!) : Infinity)
  const ordered = crews
    .filter(c => c.startNumber !== undefined)
    .sort((a, b) => rank(a) - rank(b) || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.startNumber! - b.startNumber!)
  const n = ordered.length
  const slot = (i: number) => toHHMM(toMinutes(firstStart) + i * intervalMinutes)
  return ordered.map((crew, i) => ({
    ...crew,
    plannedStartP5: slot(i),
    plannedStartC2: slot((i + Math.ceil(n / 2)) % n),
  }))
}

/**
 * Crews sharing a helmsman whose rides may overlap (start + longest 2024 ride).
 * shortMinutes: how much later the later ride would have to start.
 */
export function helmsmanClashes(crews: Crew[]): { helmsman: string; startNumbers: number[]; shortMinutes: number }[] {
  const rides = (c: Crew) =>
    ([['P5', c.plannedStartP5], ['C2', c.plannedStartC2]] as const).flatMap(([d, start]) =>
      start ? [[toMinutes(start), toMinutes(start) + RIDE_MINUTES[d].longest]] : [])
  const shortfall = (a: Crew, b: Crew) =>
    Math.max(0, ...rides(a).flatMap(([s1, e1]) => rides(b).map(([s2, e2]) => (s1 <= s2 ? e1 - s2 : e2 - s1))))

  const clashes: { helmsman: string; startNumbers: number[]; shortMinutes: number }[] = []
  crews.forEach((a, i) => crews.slice(i + 1).forEach(b => {
    const name = a.helmsman.trim()
    const shortMinutes = shortfall(a, b)
    if (name && name.toLowerCase() === b.helmsman.trim().toLowerCase() && shortMinutes > 0) {
      clashes.push({ helmsman: name, startNumbers: [a.startNumber!, b.startNumber!], shortMinutes })
    }
  }))
  return clashes
}
