import type { CrewDiscipline } from './domain/crewDiscipline.ts'
import { computeResults, type ResultRow } from './domain/results.ts'
import { formatDuration } from './domain/time.ts'
import type { AppState } from './store.ts'

/** Ride as measured, before the wait is taken off. */
const ride = (d: CrewDiscipline) =>
  d.status === 'finished'
    ? formatDuration((Date.parse(d.finish!.timestamp) - Date.parse(d.start!.timestamp)) / 1000)
    : d.status === 'out' ? 'DNF' : d.status === 'onCourse' ? 'na trati' : '—'

const place = (r: ResultRow) => (!r.rank ? '' : r.rankTo! > r.rank ? `${r.rank}.–${r.rankTo}.` : `${r.rank}.`)

const COLUMNS = ['Pořadí', 'Číslo', 'Posádka', 'Kormidelník', 'Oddíl', 'P550', 'Čekačka', 'C2', 'Celkem']

export function ResultsScreen({ state }: { state: AppState }) {
  const results = computeResults(state.crews, state.events)
  return (
    <section>
      <h1>Výsledky <button className="no-print" onClick={() => window.print()}>Tisk</button></h1>
      {!results.length && <p>Zatím žádné registrované posádky.</p>}
      {/* one table, so every category gets the same column widths */}
      <table className="results">
        {results.map(({ category, rows }) => (
          <tbody key={category} className="category">
            <tr><th colSpan={COLUMNS.length}><h2>{category}</h2></th></tr>
            <tr>{COLUMNS.map(c => <th key={c}>{c}</th>)}</tr>
            {rows.map(r => (
              <tr key={r.startNumber}>
                <td>{place(r)}</td>
                <td>{r.startNumber}</td>
                <td>{r.crew.crewName}</td>
                <td>{r.crew.helmsman}</td>
                <td>{r.crew.club}</td>
                <td>{ride(r.p5)}</td>
                <td>{r.p5.status === 'finished' ? formatDuration(r.p5.waitSeconds) : ''}</td>
                <td>{ride(r.c2)}</td>
                <td><strong>{r.total !== undefined ? formatDuration(r.total) : ''}</strong></td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </section>
  )
}
