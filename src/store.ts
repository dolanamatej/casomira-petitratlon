import { useEffect, useState } from 'react'
import type { Snapshot } from './domain/sync.ts'
import type { Crew, Discipline, Event } from './domain/types.ts'

/** Row of the sheet's stations list: which device times which station. */
export interface StationOwner {
  discipline: Discipline
  deviceId: string
  deviceName: string
  since: string
  lastSeen: string
}

export interface AppState {
  crews: Crew[]
  events: Event[]
  /** Random per browser, tags every event this notebook creates. */
  deviceId: string
  /** Shown to the other devices in the stations list. */
  deviceName: string
  discipline?: Discipline
  /** Last known from the sheet; empty when never synced. */
  stations: StationOwner[]
  /** Apps Script URL and token: kept only in this browser, never in code. */
  backup: { url: string; token: string }
  /** Events the sheet already has. */
  sentIds: string[]
  /** Crews as the sheet has them. */
  snapshot: Snapshot
  /** Finish times stopped before the crew's number was known (ISO), waiting to be assigned. */
  stops: string[]
}

/** How other devices see this one in the stations list. */
export const deviceLabel = (o: { deviceName: string; deviceId: string }) => o.deviceName || `zařízení ${o.deviceId.slice(0, 4)}`

const KEY = 'casomira'

function load(): AppState {
  const fresh: AppState = { crews: [], events: [], deviceId: crypto.randomUUID(), deviceName: '', stations: [], backup: { url: '', token: '' }, sentIds: [], snapshot: {}, stops: [] }
  const saved = localStorage.getItem(KEY)
  // older saves lack newer fields
  return saved ? { ...fresh, ...JSON.parse(saved) } : fresh
}

/** Whole app state, saved to localStorage on every change. */
export function useAppState() {
  const [state, setState] = useState(load)
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(state)), [state])
  return [state, setState] as const
}
