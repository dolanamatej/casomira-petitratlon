/** Wait from the P5 card: "m:ss", whole minutes, or empty (no wait). Undefined when unreadable. */
export function parseWait(text: string): number | undefined {
  const m = text.trim().match(/^(\d{1,3})(?::([0-5]\d))?$/)
  if (!text.trim()) return 0
  return m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : undefined
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Local 24-hour "HH:MM:SS" of an ISO timestamp. */
export const clockTime = (iso: string) => new Date(iso).toTimeString().slice(0, 8)

/** "H:MM[:SS]" on the same local day as `reference` → ISO. Undefined when unreadable. */
export function clockToIso(text: string, reference: string): string | undefined {
  const m = text.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/)
  if (!m) return undefined
  const d = new Date(reference)
  d.setHours(Number(m[1]), Number(m[2]), Number(m[3] ?? 0), 0)
  return d.toISOString()
}
