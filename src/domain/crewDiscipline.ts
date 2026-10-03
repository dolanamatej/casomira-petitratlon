import type { Discipline, Event, EventType } from './types.ts'

export type Status = 'waiting' | 'onCourse' | 'finished' | 'out'

export interface CrewDiscipline {
  status: Status
  start?: Event
  finish?: Event
  waitSeconds: number
  /** finish − start − wait; only when finished */
  seconds?: number
}

export function crewDiscipline(events: Event[], startNumber: number, discipline: Discipline): CrewDiscipline {
  const voided = new Set(events.filter(e => e.type === 'void').map(e => e.voidsEventId))
  // "last" means last created: merged logs from two devices come in any order
  const mine = events
    .filter(e => e.startNumber === startNumber && e.discipline === discipline && !voided.has(e.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const last = (...types: EventType[]) => mine.findLast(e => types.includes(e.type))

  const start = last('start')
  const finish = start && last('finish')
  const waitSeconds = last('wait')?.waitSeconds ?? 0
  const out = last('dnf')

  if (out) return { status: 'out', start, finish, waitSeconds }
  if (finish) {
    const seconds = (Date.parse(finish.timestamp) - Date.parse(start.timestamp)) / 1000 - waitSeconds
    return { status: 'finished', start, finish, waitSeconds, seconds }
  }
  return { status: start ? 'onCourse' : 'waiting', start, waitSeconds }
}
