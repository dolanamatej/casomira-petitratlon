import type { Crew, Event } from './types.ts'

export interface Log {
  crews: Crew[]
  events: Event[]
}

/** Union of two logs: events by id, crews by start number. Local (`a`) wins on conflicts. */
export function mergeLogs(a: Log, b: Log): Log {
  const numbers = new Set(a.crews.map(c => c.startNumber))
  const ids = new Set(a.events.map(e => e.id))
  return {
    // crews without a start number are only registrations on the main notebook, never merged in
    crews: [...a.crews, ...b.crews.filter(c => c.startNumber !== undefined && !numbers.has(c.startNumber))],
    events: [...a.events, ...b.events.filter(e => !ids.has(e.id))],
  }
}
