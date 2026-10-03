import { useState, type Dispatch, type SetStateAction } from 'react'
import { importCrews } from './domain/csv.ts'
import { CATEGORIES, type Category, type Crew } from './domain/types.ts'
import { WarningIcon } from './icons.tsx'
import type { AppState } from './store.ts'

interface Props {
  state: AppState
  setState: Dispatch<SetStateAction<AppState>>
}

/** Import, registration (start numbers from the vests) and editing of crews. */
export function CrewsScreen({ state, setState }: Props) {
  const [query, setQuery] = useState('')
  const [club, setClub] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const registered = state.crews.filter(c => c.startNumber !== undefined).length
  const paid = state.crews.filter(c => c.paid).length
  const clubs = [...new Set(state.crews.map(c => c.club).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs'))
  const hasEvents = (n?: number) => n !== undefined && state.events.some(e => e.startNumber === n)

  const updateCrew = (i: number, patch: Partial<Crew>) =>
    setState(s => ({ ...s, crews: s.crews.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))

  async function onImport(file: File) {
    const result = importCrews(await file.text())
    setErrors(result.errors)
    if (!result.errors.length) setState(s => ({ ...s, crews: result.crews }))
  }

  function onNumber(i: number, input: HTMLInputElement) {
    const n = input.value === '' ? undefined : Number(input.value)
    const taken = n !== undefined && state.crews.some((c, j) => j !== i && c.startNumber === n)
    input.setCustomValidity(taken ? `Číslo ${n} už má jiná posádka` : '')
    if (taken) return input.reportValidity()
    updateCrew(i, { startNumber: n })
  }

  const q = query.trim().toLowerCase()
  const visible = state.crews
    .map((crew, i) => ({ crew, i }))
    .filter(({ crew }) => !club || crew.club === club)
    .filter(({ crew }) => !q || [crew.crewName, crew.helmsman, crew.club, String(crew.startNumber ?? '')].some(f => f.toLowerCase().includes(q)))

  return (
    <section>
      <div className="page-head">
        <h1>Posádky</h1>
        <div className="counters">
          <div className="counter">Registrováno <strong>{registered}</strong> z {state.crews.length}</div>
          <div className="counter">Zaplaceno <strong>{paid}</strong> z {state.crews.length}</div>
        </div>
      </div>
      <div className="card toolbar">
        <input type="search" aria-label="Hledat" placeholder="Hledat posádku, kormidelníka, oddíl…" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
        <select aria-label="Oddíl" value={club} onChange={e => setClub(e.target.value)}>
          <option value="">Všechny oddíly</option>
          {clubs.map(c => <option key={c} value={c}>{c} ({state.crews.filter(x => x.club === c).length})</option>)}
        </select>
        {/* re-import would drop start numbers, so only before registration starts */}
        {registered === 0 && (
          <label className="file-button">
            Import CSV <input type="file" accept=".csv,text/csv" onChange={e => e.target.files?.[0] && onImport(e.target.files[0])} />
          </label>
        )}
        <button className="btn-primary" onClick={() => setState(s => ({ ...s, crews: [...s.crews, { category: 'OPEN', crewName: '', helmsman: '', club: '' }] }))}>
          Přidat posádku
        </button>
      </div>
      {errors.length > 0 && (
        <div role="alert" className="alert errors">
          <WarningIcon />
          <div><div className="alert-title">Import CSV se nepovedl</div><ul>{errors.map(e => <li key={e}>{e}</li>)}</ul></div>
        </div>
      )}
      <div className="card table-card">
        <table className="table crews-table">
          <colgroup><col style={{ width: 92 }} /><col style={{ width: 130 }} /><col style={{ width: 150 }} /><col style={{ width: '28%' }} /><col style={{ width: '20%' }} /><col /></colgroup>
          <thead>
            <tr><th>Číslo</th><th>Zaplaceno</th><th className="inset">Kategorie</th><th className="inset">Posádka</th><th className="inset">Kormidelník</th><th className="inset">Oddíl</th></tr>
          </thead>
          <tbody>
            {visible.map(({ crew, i }) => (
              <tr key={i} className={crew.startNumber === undefined ? 'unregistered' : undefined}>
                <td>
                  <input
                    type="number" min={1} className="bib" defaultValue={crew.startNumber} placeholder=" " aria-label="Startovní číslo"
                    disabled={hasEvents(crew.startNumber)} title={hasEvents(crew.startNumber) ? 'Posádka už má události, číslo nejde změnit' : 'Bez čísla: posádka ještě není registrovaná'}
                    onBlur={e => onNumber(i, e.currentTarget)}
                    onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                </td>
                <td>
                  <label className={crew.paid ? 'paid yes' : 'paid'}>
                    <input type="checkbox" aria-label="Zaplaceno" checked={!!crew.paid} onChange={e => updateCrew(i, { paid: e.target.checked })} />
                    {crew.paid ? 'ano' : 'ne'}
                  </label>
                </td>
                <td className="secondary">
                  <select className="cell-input" aria-label="Kategorie" value={crew.category} onChange={e => updateCrew(i, { category: e.target.value as Category })}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td className="crew-name-cell"><input className="cell-input" aria-label="Posádka" value={crew.crewName} onChange={e => updateCrew(i, { crewName: e.target.value })} /></td>
                <td className="secondary"><input className="cell-input" aria-label="Kormidelník" value={crew.helmsman} onChange={e => updateCrew(i, { helmsman: e.target.value })} /></td>
                <td className="secondary"><input className="cell-input" aria-label="Oddíl" value={crew.club} onChange={e => updateCrew(i, { club: e.target.value })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
