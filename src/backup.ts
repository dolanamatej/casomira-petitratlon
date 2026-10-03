import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Log } from './domain/merge.ts'
import { casovkaCells, crewsToSend, mergeRemote, snapshotOf } from './domain/sync.ts'
import type { Crew, Event } from './domain/types.ts'
import type { AppState } from './store.ts'

export interface BackupStatus {
  configured: boolean
  pending: number
  busy: boolean
  lastOk?: Date
  error?: string
  /** Data is backed up, but the human-readable časovka could not be fully written. */
  casovkaWarnings?: string[]
}

const RETRY_MS = 15_000

/** Pushes unsent events, changed crews and this station's časovka cells; retries until it gets through. */
export function useBackup(state: AppState, setState: Dispatch<SetStateAction<AppState>>) {
  const [status, setStatus] = useState<Omit<BackupStatus, 'pending' | 'configured'>>({ busy: false })
  const busy = useRef(false)
  const { url, token } = state.backup
  const sent = new Set(state.sentIds)
  const pendingEvents = state.events.filter(e => !sent.has(e.id))
  const pendingCrews = crewsToSend(state.crews, state.snapshot)
  const pending = pendingEvents.length + pendingCrews.length

  const push = useCallback(async () => {
    if (!url || busy.current || !pending) return
    busy.current = true
    setStatus(s => ({ ...s, busy: true }))
    // časovka columns of a discipline belong to the notebook that times it: write only for our own events
    const casovka = casovkaCells(state.events, state.crews, pendingEvents.filter(e => e.deviceId === state.deviceId))
    try {
      const { warnings } = await call(url, { method: 'POST', body: JSON.stringify({ token, events: pendingEvents, crews: pendingCrews, casovka }) })
      setState(s => ({
        ...s,
        sentIds: [...s.sentIds, ...pendingEvents.map(e => e.id)],
        snapshot: snapshotOf(pendingCrews, s.snapshot),
      }))
      setStatus({ busy: false, lastOk: new Date(), casovkaWarnings: warnings ?? [] })
    } catch (err) {
      setStatus(s => ({ ...s, busy: false, error: String(err instanceof Error ? err.message : err) }))
    } finally {
      busy.current = false
    }
  }, [url, token, pending, state, pendingEvents, pendingCrews, setState])

  // send soon after every change, and keep retrying while something is pending
  useEffect(() => {
    if (!pending) return
    const soon = setTimeout(push, 1000)
    const retry = setInterval(push, RETRY_MS)
    return () => { clearTimeout(soon); clearInterval(retry) }
  }, [pending, push])

  async function pull() {
    const data = await call(`${url}?token=${encodeURIComponent(token)}`)
    const remote: Log = { crews: data.crews.map(crewFromSheet), events: data.events.map(eventFromSheet) }
    setState(s => {
      const merged = mergeRemote(s, remote, s.snapshot)
      return { ...s, ...merged, sentIds: [...new Set([...s.sentIds, ...remote.events.map(e => e.id)])] }
    })
    return remote
  }

  /** Forget the last result, e.g. after wiping data, so old warnings do not linger. */
  const resetStatus = () => setStatus({ busy: false })

  return { status: { ...status, pending, configured: !!url }, push, pull, resetStatus }
}

async function call(url: string, init?: RequestInit) {
  // text/plain keeps it a simple request: Apps Script cannot answer a CORS preflight
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: AbortSignal.timeout(30_000) })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error)
  return data
}

// the sheet returns '' for empty cells and may return numbers as text
const optional = <T,>(v: T | '') => (v === '' ? undefined : v)
const crewFromSheet = (r: Record<string, string | number>): Crew => ({
  startNumber: Number(r.startNumber),
  category: String(r.category) as Crew['category'],
  crewName: String(r.crewName),
  helmsman: String(r.helmsman),
  club: String(r.club),
  plannedStartP5: optional(String(r.plannedStartP5)),
  plannedStartC2: optional(String(r.plannedStartC2)),
  paid: String(r.paid) === 'true',
})
const eventFromSheet = (r: Record<string, string | number>): Event => ({
  id: String(r.id),
  startNumber: Number(r.startNumber),
  discipline: String(r.discipline) as Event['discipline'],
  type: String(r.type) as Event['type'],
  timestamp: String(r.timestamp),
  waitSeconds: r.waitSeconds === '' ? undefined : Number(r.waitSeconds),
  voidsEventId: optional(String(r.voidsEventId)),
  deviceId: String(r.deviceId),
  createdAt: String(r.createdAt),
})
