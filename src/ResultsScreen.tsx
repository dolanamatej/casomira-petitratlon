import type { CrewDiscipline } from './domain/crewDiscipline.ts'
import { computeResults } from './domain/results.ts'
import { formatDuration } from './domain/time.ts'
import type { AppState } from './store.ts'

const time = (d: CrewDiscipline) =>
  d.status === 'finished' ? formatDuration(d.seconds!) : d.status === 'out' ? 'DNF' : d.status === 'onCourse' ? 'na trati' : '—'

export function ResultsScreen({ state }: { state: AppState }) {
  const results = computeResults(state.crews, state.events)
  return (
    <section>
      <h1>Výsledky <button className="no-print" onClick={() => window.print()}>Tisk</button></h1>
      {!results.length && <p>Zatím žádné registrované posádky.</p>}
      {results.map(({ category, rows }) => (
        <div key={category} className="category">
          <h2>{category}</h2>
          <table className="results">
            <thead>
              <tr><th>Pořadí</th><th>Číslo</th><th>Posádka</th><th>Kormidelník</th><th>Oddíl</th><th>P5</th><th>Čekačka</th><th>C2</th><th>Celkem</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.startNumber}>
                  <td>{r.rank ? `${r.rank}.` : ''}</td>
                  <td>{r.startNumber}</td>
                  <td>{r.crew.crewName}</td>
                  <td>{r.crew.helmsman}</td>
                  <td>{r.crew.club}</td>
                  <td>{time(r.p5)}</td>
                  <td>{r.p5.waitSeconds ? formatDuration(r.p5.waitSeconds) : ''}</td>
                  <td>{time(r.c2)}</td>
                  <td><strong>{r.total !== undefined ? formatDuration(r.total) : ''}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  )
}
