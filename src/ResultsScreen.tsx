import { useEffect, useRef, useState } from 'react'
import type { CrewDiscipline } from './domain/crewDiscipline.ts'
import { computeResults, type ResultRow } from './domain/results.ts'
import { formatDuration } from './domain/time.ts'
import type { AppState } from './store.ts'

const DASH = <span className="dash">–</span>

/** Ride as measured, before the wait is taken off. */
const ride = (d: CrewDiscipline) =>
  d.status === 'finished'
    ? formatDuration((Date.parse(d.finish!.timestamp) - Date.parse(d.start!.timestamp)) / 1000)
    : d.status === 'out' ? <strong>DNF</strong> : d.status === 'onCourse' ? <span className="badge badge-warning">na trati</span> : DASH

const place = (r: ResultRow) => (!r.rank ? DASH : r.rankTo! > r.rank ? `${r.rank}.–${r.rankTo}.` : `${r.rank}.`)

const COLUMNS = ['Pořadí', 'Číslo', 'Posádka', 'P550', 'Čekačka', 'C2', 'Celkem']

/** Print keeps the plain pre-redesign sheet: text only, helmsman and club in their own columns. */
const PRINT_COLUMNS = ['Pořadí', 'Číslo', 'Posádka', 'Kormidelník', 'Oddíl', 'P550', 'Čekačka', 'C2', 'Celkem']
// landscape A4; club names are long ("7. OVS Štiky, Junák – český skaut, přístav …"), so the club gets the room
const PRINT_WIDTHS = ['6%', '5.5%', '14.5%', '11%', '33%', '7.5%', '7.5%', '7.5%', '7.5%']
const printRide = (d: CrewDiscipline) =>
  d.status === 'finished'
    ? formatDuration((Date.parse(d.finish!.timestamp) - Date.parse(d.start!.timestamp)) / 1000)
    : d.status === 'out' ? 'DNF' : d.status === 'onCourse' ? 'na trati' : '—'
const printPlace = (r: ResultRow) => (!r.rank ? '' : r.rankTo! > r.rank ? `${r.rank}.–${r.rankTo}.` : `${r.rank}.`)

/** The other station's events arrive only from the sheet, so results refresh them while open. */
const PULL_MS = 60_000

export function ResultsScreen({ state, pull }: { state: AppState; pull?: () => Promise<unknown> }) {
  const [pulled, setPulled] = useState<{ at?: Date; error?: string }>({})
  // interval calls the latest pull without restarting on every render
  const latestPull = useRef(pull)
  useEffect(() => { latestPull.current = pull })
  useEffect(() => {
    const refresh = () => latestPull.current?.().then(
      () => setPulled({ at: new Date() }),
      err => setPulled(p => ({ ...p, error: String(err instanceof Error ? err.message : err) })),
    )
    refresh()
    const id = setInterval(refresh, PULL_MS)
    return () => clearInterval(id)
  }, [])
  const results = computeResults(state.crews, state.events)
  const all = results.flatMap(r => r.rows)
  const onCourse = all.filter(r => r.p5.status === 'onCourse' || r.c2.status === 'onCourse').length
  const finished = all.filter(r => r.total !== undefined).length
  return (
    <section className="results-screen">
      <div className="page-head results-head">
        <h1>Výsledky</h1>
        {all.length > 0 && <span className="muted no-print">Na trati {onCourse} · dokončeno {finished} z {all.length}</span>}
        {pull && (
          <span className={pulled.error ? 'muted no-print warn-text' : 'muted no-print'}>
            {pulled.at ? `Data z tabulky ${pulled.at.toTimeString().slice(0, 8)}` : 'Stahuji data z tabulky…'}
            {pulled.error && ` · stažení selhalo: ${pulled.error}`}
          </span>
        )}
        {!pull && <span className="muted no-print">Záloha nenastavená: druhé stanoviště tu chybí</span>}
        <button className="print no-print" onClick={() => window.print()}>Tisk</button>
      </div>
      {!results.length && <p className="card card-pad">Zatím žádné registrované posádky.</p>}
      <div className="results-grid no-print">
        {results.map(({ category, rows }) => (
          <section key={category} className="card">
            <div className="card-head"><h2 className="card-title">{category} <span className="count">{rows.length}</span></h2></div>
            <table className="table">
              {/* same fixed widths in every card, so the columns line up across categories */}
              <colgroup>
                <col style={{ width: 84 }} /><col style={{ width: 72 }} /><col /><col style={{ width: 100 }} /><col style={{ width: 92 }} /><col style={{ width: 92 }} /><col style={{ width: 104 }} />
              </colgroup>
              <thead>
                <tr>{COLUMNS.map((c, i) => <th key={c} className={i > 2 ? 'num' : undefined}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.startNumber}>
                    <td className="place">{place(r)}</td>
                    <td><span className="bib">{r.startNumber}</span></td>
                    <td className="crew-cell">
                      <strong>{r.crew.crewName}</strong>
                      <div className="crew-sub">{[r.crew.helmsman, r.crew.club].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="num">{ride(r.p5)}</td>
                    <td className="num">{r.p5.status === 'finished' ? formatDuration(r.p5.waitSeconds) : DASH}</td>
                    <td className="num">{ride(r.c2)}</td>
                    <td className="num total">{r.total !== undefined ? formatDuration(r.total) : DASH}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      {/* a table per category, so a category never splits across pages; fixed widths keep the columns aligned */}
      {results.map(({ category, rows }) => (
        <table key={category} className="print-only print-results">
          <colgroup>{PRINT_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
          <thead>
            <tr><th colSpan={PRINT_COLUMNS.length}><h2>{category}</h2></th></tr>
            <tr>{PRINT_COLUMNS.map(c => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.startNumber}>
                <td>{printPlace(r)}</td>
                <td>{r.startNumber}</td>
                <td>{r.crew.crewName}</td>
                <td>{r.crew.helmsman}</td>
                <td>{r.crew.club}</td>
                <td>{printRide(r.p5)}</td>
                <td>{r.p5.status === 'finished' ? formatDuration(r.p5.waitSeconds) : ''}</td>
                <td>{printRide(r.c2)}</td>
                <td><strong>{r.total !== undefined ? formatDuration(r.total) : ''}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </section>
  )
}
