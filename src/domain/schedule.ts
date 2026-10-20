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

/** Each category spread evenly over the order, so fast and slow crews alternate from the first start. */
function mixCategories(crews: Crew[]): Crew[] {
  return CATEGORIES.flatMap(cat => {
    const list = crews.filter(c => c.category === cat).sort((a, b) => a.startNumber! - b.startNumber!)
    return list.map((crew, i) => ({ crew, at: (i + 0.5) / list.length }))
  }).sort((a, b) => a.at - b.at).map(x => x.crew) // stable: ties go slower category first
}

/** Planned starts for crews in P5 order; C2 is shifted by half the slots. */
function plan(ordered: Crew[], { firstStart, intervalMinutes }: ScheduleParams): Crew[] {
  const n = ordered.length
  const slot = (i: number) => toHHMM(toMinutes(firstStart) + i * intervalMinutes)
  return ordered.map((crew, i) => ({
    ...crew,
    plannedStartP5: slot(i),
    plannedStartC2: slot((i + Math.ceil(n / 2)) % n),
  }))
}

const clashMinutes = (crews: Crew[]) => crewClashes(crews).reduce((sum, c) => sum + c.shortMinutes, 0)

/**
 * Priority crews one by one into the earliest slot where they clash least,
 * so two priority crews sharing people still go as soon after each other as
 * they can. Other crews fill the gaps in the mixed order.
 */
function placePriority(mixed: Crew[], params: ScheduleParams): Crew[] {
  // times depend only on the slot, so plan an all-slots template once
  const times = plan(mixed, params)
  const at = (crew: Crew, i: number) => ({ ...crew, plannedStartP5: times[i].plannedStartP5, plannedStartC2: times[i].plannedStartC2 })
  const slots: (Crew | undefined)[] = mixed.map(() => undefined)
  for (const crew of mixed.filter(c => c.priority)) {
    const placed = slots.flatMap((c, i) => (c ? [at(c, i)] : []))
    let best = -1, bestCost = Infinity
    slots.forEach((c, i) => {
      const cost = c ? Infinity : clashMinutes([at(crew, i), ...placed])
      if (cost < bestCost) [best, bestCost] = [i, cost]
    })
    slots[best] = crew
  }
  const rest = mixed.filter(c => !c.priority)
  return slots.map(c => c ?? rest.shift()!)
}

/**
 * Swap crews until no clash is left or no swap helps; prefers the swap that
 * improves most, then the shortest move.
 * ponytail: greedy over all pairs, O(n²) per step; fine for tens of crews.
 */
function untangle(ordered: Crew[], params: ScheduleParams): Crew[] {
  const order = [...ordered]
  const cost = () => clashMinutes(plan(order, params))
  const swap = (i: number, j: number) => ([order[i], order[j]] = [order[j], order[i]])
  for (let current = cost(); current > 0;) {
    let best: [number, number] | undefined, bestCost = current
    for (let d = 1; d < order.length; d++) {
      for (let i = 0; i + d < order.length; i++) {
        if (order[i].priority || order[i + d].priority) continue // already as early as they can be
        swap(i, i + d)
        const c = cost()
        if (c < bestCost) [best, bestCost] = [[i, i + d], c]
        swap(i, i + d)
      }
    }
    if (!best) break
    swap(...best)
    current = bestCost
  }
  return order
}

/**
 * Registered crews in P5 start order, with planned starts on both stations.
 * Priority crews start P5 first, as early as their clashes allow. Without an explicit order the categories are mixed and clashes resolved.
 */
export function generateSchedule(crews: Crew[], params: ScheduleParams, order?: number[]): Crew[] {
  const registered = mixCategories(crews.filter(c => c.startNumber !== undefined))
  if (!order) return plan(untangle(placePriority(registered, params), params), params)
  const mixed = [...registered.filter(c => c.priority), ...registered.filter(c => !c.priority)]
  // explicit order first, everyone else in the mixed order
  const rank = (c: Crew) => (order.includes(c.startNumber!) ? order.indexOf(c.startNumber!) : Infinity)
  return plan(mixed.sort((a, b) => rank(a) - rank(b)), params)
}

/** Start numbers from the "shares members with" field, e.g. "12, 15". */
export const sharedWith = (c: Crew) => (c.sharesWith?.match(/\d+/g) ?? []).map(Number)

const sameHelmsman = (a: Crew, b: Crew) => {
  const name = a.helmsman.trim().toLowerCase()
  return !!name && name === b.helmsman.trim().toLowerCase()
}

export interface Clash {
  /** Set when the crews share the helmsman; otherwise they share other members. */
  helmsman?: string
  startNumbers: [number, number]
  /** How much later the later ride would have to start. */
  shortMinutes: number
}

/** Crews sharing a helmsman or other members whose rides may overlap (start + longest 2024 ride). */
export function crewClashes(crews: Crew[]): Clash[] {
  const rides = (c: Crew) =>
    ([['P5', c.plannedStartP5], ['C2', c.plannedStartC2]] as const).flatMap(([d, start]) =>
      start ? [[toMinutes(start), toMinutes(start) + RIDE_MINUTES[d].longest]] : [])
  const shortfall = (a: Crew, b: Crew) =>
    Math.max(0, ...rides(a).flatMap(([s1, e1]) => rides(b).map(([s2, e2]) => (s1 <= s2 ? e1 - s2 : e2 - s1))))

  const clashes: Clash[] = []
  crews.forEach((a, i) => crews.slice(i + 1).forEach(b => {
    const helmsman = sameHelmsman(a, b)
    if (!helmsman && !sharedWith(a).includes(b.startNumber!) && !sharedWith(b).includes(a.startNumber!)) return
    const shortMinutes = shortfall(a, b)
    if (shortMinutes > 0) clashes.push({ helmsman: helmsman ? a.helmsman.trim() : undefined, startNumbers: [a.startNumber!, b.startNumber!], shortMinutes })
  }))
  return clashes
}
