import { useEffect, useState } from 'react'
import type { Snapshot } from './domain/sync.ts'
import type { Crew, Discipline, Event } from './domain/types.ts'

export interface AppState {
  crews: Crew[]
  events: Event[]
  /** Random per browser, tags every event this notebook creates. */
  deviceId: string
  discipline?: Discipline
  /** Apps Script URL and token: kept only in this browser, never in code. */
  backup: { url: string; token: string }
  /** Events the sheet already has. */
  sentIds: string[]
  /** Crews as the sheet has them. */
  snapshot: Snapshot
}

const KEY = 'casomira'

function load(): AppState {
  const fresh: AppState = { crews: [], events: [], deviceId: crypto.randomUUID(), backup: { url: '', token: '' }, sentIds: [], snapshot: {} }
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
