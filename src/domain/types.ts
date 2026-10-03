export type Discipline = 'P5' | 'C2'
/** What people see; 'P5' stays the code in data and the sheet's event log. */
export const DISCIPLINE_NAME: Record<Discipline, string> = { P5: 'pramice (P550)', C2: 'kánoe (C2)' }
export type EventType = 'start' | 'finish' | 'wait' | 'dnf' | 'void'

export interface Event {
  id: string
  startNumber: number
  discipline: Discipline
  type: EventType
  /** ISO timestamp; for start/finish the moment it happened */
  timestamp: string
  waitSeconds?: number
  voidsEventId?: string
  deviceId: string
  createdAt: string
}

/** Ordered from the slowest; P5 start order follows this. */
export const CATEGORIES = ['Žabičky', 'Vlčata', 'Skautky', 'Skauti', 'OPEN'] as const
export type Category = (typeof CATEGORIES)[number]

export interface Crew {
  /** Missing until registration; the only crew identifier afterwards. */
  startNumber?: number
  category: Category
  crewName: string
  helmsman: string
  club: string
  /** Entry fee paid, ticked at registration. */
  paid?: boolean
  /** "HH:MM" from the schedule, orientation only */
  plannedStartP5?: string
  plannedStartC2?: string
}
