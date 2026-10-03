import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Log } from './domain/merge.ts'
import { casovkaCells, crewsToSend, mergeRemote, snapshotOf } from './domain/sync.ts'
import type { Crew, Discipline, Event } from './domain/types.ts'
import type { AppState, StationOwner } from './store.ts'

export interface BackupStatus {
  configured: boolean
  pending: number
  busy: boolean
  lastOk?: Date
  error?: string
  /** Data is backed up, but the human-readable časovka could not be fully written. */
  casovkaWarnings?: string[]
}

/** Retry for unsent data, and heartbeat that keeps the station claimed. */
const RETRY_MS = 15_000

/** Pushes unsent events, changed crews and this station's časovka cells; retries until it gets through. */
export function useBackup(state: AppState, setState: Dispatch<SetStateAction<AppState>>) {
  const [status, setStatus] = useState<Omit<BackupStatus, 'pending' | 'configured'>>({ busy: false })
  const [takingOver, setTakingOver] = useState<Discipline>()
  const busy = useRef(false)
  const { url, token } = state.backup
  const sent = new Set(state.sentIds)
  const pendingEvents = state.events.filter(e => !sent.has(e.id))
  const pendingCrews = crewsToSend(state.crews, state.snapshot)
  const pending = pendingEvents.length + pendingCrews.length

  /**
   * One request. `claim` asks for a station before timing it; with `takeover`
   * the station moves to this device even if another one has it. Claims throw on failure.
   */
  async function push(claim?: { discipline: Discipline; takeover: boolean }): Promise<StationOwner[] | undefined> {
    const discipline = claim?.discipline ?? state.discipline
    const takeover = !!claim?.takeover
    if (!url || (busy.current && !claim) || (!pending && !discipline)) return
    busy.current = true
    setStatus(s => ({ ...s, busy: true }))
    const station = discipline && { discipline, deviceId: state.deviceId, deviceName: state.deviceName }
    // časovka columns belong to the device timing that station; the script drops cells we do not own
    const casovka = casovkaCells(state.events, state.crews, pendingEvents.filter(e => e.deviceId === state.deviceId))
    try {
      const data = await call(url, {
        method: 'POST',
        body: JSON.stringify({ token, events: pendingEvents, crews: pendingCrews, casovka, station, takeover }),
      })
      const stations = parseStations(data)
      const warnings: string[] = [...(data.warnings ?? []), ...(stations ? [] : [OLD_SCRIPT])]
      setState(s => ({
        ...s,
        stations: stations ?? s.stations,
        sentIds: [...s.sentIds, ...pendingEvents.map(e => e.id)],
        snapshot: snapshotOf(pendingCrews, s.snapshot),
      }))
      setStatus({ busy: false, lastOk: new Date(), casovkaWarnings: warnings })
      return stations
    } catch (err) {
      setStatus(s => ({ ...s, busy: false, error: String(err instanceof Error ? err.message : err) }))
      if (claim) throw err
    } finally {
      busy.current = false
    }
  }
  // timers call the latest push without being reset on every render
  const latestPush = useRef(push)
  useEffect(() => { latestPush.current = push })

  // send soon after every change
  useEffect(() => {
    if (!pending) return
    const soon = setTimeout(() => latestPush.current(), 1000)
    return () => clearTimeout(soon)
  }, [pending])
  // retry unsent data, and keep the station claimed while timing
  useEffect(() => {
    if (!url) return
    const retry = setInterval(() => latestPush.current(), RETRY_MS)
    return () => clearInterval(retry)
  }, [url])

  async function pull() {
    const data = await call(`${url}?token=${encodeURIComponent(token)}`)
    const remote: Log = { crews: data.crews.map(crewFromSheet), events: data.events.map(eventFromSheet) }
    const stations = parseStations(data)
    setState(s => {
      const merged = mergeRemote(s, remote, s.snapshot)
      return {
        ...s,
        ...merged,
        stations: stations ?? s.stations,
        sentIds: [...new Set([...s.sentIds, ...remote.events.map(e => e.id)])],
      }
    })
    return remote
  }

  /** Forget the last result, e.g. after wiping data, so old warnings do not linger. */
  const resetStatus = () => setStatus({ busy: false })

  /**
   * Make this device the one timing `discipline`: claim it in the sheet, then
   * download everything (starts of crews on course included). Needs the network.
   */
  async function takeover(discipline: Discipline) {
    setTakingOver(discipline)
    try {
      await push({ discipline, takeover: true })
      await pull()
      setState(s => ({ ...s, discipline }))
    } finally {
      setTakingOver(undefined)
    }
  }

  /**
   * Ask the sheet for a station before timing it, so two devices never time the
   * same course. Resolves to the owner afterwards (this device unless another has it).
   */
  async function claim(discipline: Discipline): Promise<StationOwner | undefined> {
    setTakingOver(discipline)
    try {
      const stations = await push({ discipline, takeover: false })
      const owner = stations?.find(s => s.discipline === discipline)
      if (owner?.deviceId === state.deviceId) setState(s => ({ ...s, discipline }))
      return owner
    } finally {
      setTakingOver(undefined)
    }
  }

  return { status: { ...status, pending, configured: !!url }, push: () => push(), pull, resetStatus, takeover, claim, takingOver }
}

async function call(url: string, init?: RequestInit) {
  // text/plain keeps it a simple request: Apps Script cannot answer a CORS preflight
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: AbortSignal.timeout(60_000) })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    // Google answers script crashes and timeouts with an HTML page; show its message
    const message = new DOMParser().parseFromString(text, 'text/html').body.textContent?.replace(/\s+/g, ' ').trim()
    throw new Error(`Skript neodpověděl daty: ${message?.slice(0, 200) || res.status}`)
  }
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
const OLD_SCRIPT = 'Skript v tabulce je zastaralý: vložte aktuální Code.gs a vydejte novou verzi nasazení.'

/** Undefined when the deployed script predates the stations list. */
const parseStations = (data: { stations?: Record<string, string>[] }) => data.stations?.map(stationFromSheet)

const stationFromSheet = (r: Record<string, string>): StationOwner => ({
  discipline: r.discipline as StationOwner['discipline'],
  deviceId: String(r.deviceId),
  deviceName: String(r.deviceName),
  since: String(r.since),
  lastSeen: String(r.lastSeen),
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
