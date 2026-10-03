import { crewDiscipline } from './crewDiscipline.ts'
import type { Log } from './merge.ts'
import { clockTime, formatDuration } from './time.ts'
import type { Category, Crew, Discipline, Event } from './types.ts'

/** Start number → crew as last sent to (or received from) the sheet. */
export type Snapshot = Record<number, string>

// fixed field order and '' for missing, so a crew read back from the sheet compares equal
const canonical = (c: Crew) =>
  JSON.stringify([c.startNumber, c.category, c.crewName, c.helmsman, c.club, c.plannedStartP5 ?? '', c.plannedStartC2 ?? '', !!c.paid])

export const snapshotOf = (crews: Crew[], base: Snapshot = {}): Snapshot =>
  Object.fromEntries([...Object.entries(base), ...crews.filter(c => c.startNumber !== undefined).map(c => [c.startNumber, canonical(c)])])

/** Registered crews that changed since they were last sent or received. */
export const crewsToSend = (crews: Crew[], snapshot: Snapshot) =>
  crews.filter(c => c.startNumber !== undefined && snapshot[c.startNumber] !== canonical(c))

/**
 * Sheet data into the local log: events by id; crews from the sheet win
 * unless this notebook changed them and has not sent them yet.
 */
export function mergeRemote(local: Log, remote: Log, snapshot: Snapshot): Log & { snapshot: Snapshot } {
  const unsent = new Set(crewsToSend(local.crews, snapshot).map(c => c.startNumber))
  const remoteByNumber = new Map(remote.crews.map(c => [c.startNumber, c]))
  const localNumbers = new Set(local.crews.map(c => c.startNumber))
  const ids = new Set(local.events.map(e => e.id))
  return {
    crews: [
      ...local.crews.map(c => (!unsent.has(c.startNumber) && remoteByNumber.get(c.startNumber)) || c),
      ...remote.crews.filter(c => !localNumbers.has(c.startNumber)),
    ],
    events: [...local.events, ...remote.events.filter(e => !ids.has(e.id))],
    snapshot: snapshotOf(remote.crews, snapshot),
  }
}

export interface CasovkaUpdate {
  startNumber: number
  category: Category
  discipline: Discipline
  cells: { start: string; finish: string; wait?: string }
}

/** Current values of the časovka columns for each crew and discipline the touched events belong to. */
export function casovkaCells(events: Event[], crews: Crew[], touched: Event[]): CasovkaUpdate[] {
  const keys = [...new Set(touched.map(e => `${e.startNumber}|${e.discipline}`))].map(k => k.split('|'))
  return keys.flatMap(([number, discipline]) => {
    const crew = crews.find(c => c.startNumber === Number(number))
    if (!crew) return []
    const d = crewDiscipline(events, crew.startNumber!, discipline as Discipline)
    const cells: CasovkaUpdate['cells'] = {
      start: d.start ? clockTime(d.start.timestamp) : '',
      finish: d.status === 'out' ? 'DNF' : d.finish ? clockTime(d.finish.timestamp) : '',
    }
    // like the template: 0:00:00, not an empty cell
    if (discipline === 'P5') cells.wait = formatDuration(d.waitSeconds)
    return [{ startNumber: crew.startNumber!, category: crew.category, discipline: discipline as Discipline, cells }]
  })
}
