import { useEffect, useState } from 'react'
import type { Crew, Discipline, Event } from './domain/types.ts'

export interface AppState {
  crews: Crew[]
  events: Event[]
  /** Random per browser, tags every event this notebook creates. */
  deviceId: string
  discipline?: Discipline
}

const KEY = 'casomira'

function load(): AppState {
  const saved = localStorage.getItem(KEY)
  return saved ? JSON.parse(saved) : { crews: [], events: [], deviceId: crypto.randomUUID() }
}

/** Whole app state, saved to localStorage on every change. */
export function useAppState() {
  const [state, setState] = useState(load)
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(state)), [state])
  return [state, setState] as const
}
