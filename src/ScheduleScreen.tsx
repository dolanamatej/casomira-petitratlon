import { useState, type Dispatch, type SetStateAction } from 'react'
import { generateSchedule, helmsmanClashes, scheduleStats } from './domain/schedule.ts'
import { DISCIPLINE_NAME, type Crew, type Discipline } from './domain/types.ts'
import { WarningIcon } from './icons.tsx'
import type { AppState } from './store.ts'

interface Props {
  state: AppState
  setState: Dispatch<SetStateAction<AppState>>
}

const BOAT_LIMIT = 4
const MIN_REST = 30
const planned = (c: Crew, d: Discipline) => (d === 'P5' ? c.plannedStartP5 : c.plannedStartC2)

/** While dragging, scroll the page when the pointer nears the top or bottom of the window. */
function scrollNearEdge(clientY: number) {
  const EDGE = 100
  const fromBottom = window.innerHeight - clientY
  // dragover repeats every ~50 ms, so a step per event scrolls smoothly; faster closer to the edge
  if (clientY < EDGE) window.scrollBy(0, -Math.ceil((EDGE - clientY) / 4))
  else if (fromBottom < EDGE) window.scrollBy(0, Math.ceil((EDGE - fromBottom) / 4))
}

export function ScheduleScreen({ state, setState }: Props) {
  const [firstStart, setFirstStart] = useState('10:30')
  const [intervalMinutes, setIntervalMinutes] = useState(8)
  const [printing, setPrinting] = useState<Discipline>()
  const [dragged, setDragged] = useState<number>()
  const [dropTarget, setDropTarget] = useState<number>()
  const registered = state.crews.filter(c => c.startNumber !== undefined)
  const stats = scheduleStats(registered.length, { firstStart, intervalMinutes })

  const apply = (order?: number[]) => {
    const byNumber = new Map(generateSchedule(state.crews, { firstStart, intervalMinutes }, order).map(c => [c.startNumber, c]))
    setState(s => ({ ...s, crews: s.crews.map(c => byNumber.get(c.startNumber) ?? c) }))
  }

  function generate() {
    if (registered.some(c => c.plannedStartP5) && !confirm('Přepsat stávající startovku včetně ručních úprav?')) return
    apply()
  }

  /** Put a crew in place of another in the P5 order and recompute all times from the new order. */
  function move(startNumber: number, target: number) {
    const order = registered.filter(c => c.plannedStartP5).sort((a, b) => a.plannedStartP5!.localeCompare(b.plannedStartP5!)).map(c => c.startNumber!)
    const to = order.indexOf(target)
    order.splice(order.indexOf(startNumber), 1)
    order.splice(to, 0, startNumber)
    apply(order)
  }

  const setPlanned = (startNumber: number, d: Discipline, time: string) =>
    setState(s => ({
      ...s,
      crews: s.crews.map(c => (c.startNumber !== startNumber ? c : d === 'P5' ? { ...c, plannedStartP5: time } : { ...c, plannedStartC2: time })),
    }))

  function print(d: Discipline) {
    setPrinting(d)
    // let React hide the other station before the print dialog snapshots the page
    setTimeout(() => { window.print(); setPrinting(undefined) })
  }

  const clashes = helmsmanClashes(registered)
  const clashing = new Set(clashes.flatMap(c => c.startNumbers))
  const decimal = (n: number) => n.toFixed(1).replace('.', ',')

  return (
    <section onDragOver={e => dragged !== undefined && scrollNearEdge(e.clientY)}>
      <div className="page-head no-print"><h1>Startovka</h1></div>
      <div className="card card-pad params no-print">
        <div className="params-form">
          <label className="field">Začátek <TimeInput value={firstStart} onChange={setFirstStart} /></label>
          <label className="field">Rozestup (min) <input type="number" min={1} value={intervalMinutes} onChange={e => setIntervalMinutes(Number(e.target.value) || 1)} /></label>
          <button className="btn-primary" onClick={generate} disabled={!registered.length}>Vygenerovat startovku</button>
          <p className="help">Doporučený rozestup je 8 min. Počítá se s {registered.length} registrovanými posádkami.</p>
        </div>
        <div className="figures">
          <div className="figure"><div className="figure-label">Poslední start</div><div className="figure-value">{stats.lastStart}</div></div>
          <div className="figure"><div className="figure-label">Odhad konce</div><div className="figure-value">{stats.estimatedEnd}</div></div>
          <div className="figure">
            <div className="figure-label">Typicky na trati</div>
            <div className="figure-value small">{decimal(stats.typicalOnCourse.P5)} pramic<br />{decimal(stats.typicalOnCourse.C2)} kánoí</div>
          </div>
          <div className="figure"><div className="figure-label">Odpočinek nejméně</div><div className="figure-value">{stats.minRestMinutes} min</div></div>
        </div>
        {stats.typicalOnCourse.P5 > BOAT_LIMIT && <p className="notice">Na trati bude typicky víc než {BOAT_LIMIT} pramice.</p>}
        {stats.typicalOnCourse.C2 > BOAT_LIMIT && <p className="notice">Na trati bude typicky víc než {BOAT_LIMIT} kánoe.</p>}
        {registered.length > 1 && stats.minRestMinutes < MIN_REST && <p className="notice">Nejpomalejší posádka bude mít mezi disciplínami méně než {MIN_REST} min.</p>}
      </div>
      {clashes.length > 0 && (
        <div role="alert" className="alert clashes no-print">
          <WarningIcon />
          <div>
            {clashes.map(({ helmsman, startNumbers: [a, b], shortMinutes }) => (
              <div className="alert-item" key={`${a}-${b}`}>
                <div className="alert-title">Kormidelník {helmsman} řídí posádky {a} a {b}</div>
                Pozdější jízda by musela startovat o {shortMinutes} min později. Přetáhněte jednu z nich jinam.
              </div>
            ))}
          </div>
        </div>
      )}

      {(['P5', 'C2'] as const).map(d => {
        const rows = registered.filter(c => planned(c, d)).sort((a, b) => planned(a, d)!.localeCompare(planned(b, d)!))
        const times = rows.map(c => planned(c, d))
        if (!rows.length || (printing && printing !== d)) return null
        return (
          <div key={d} className="card table-card schedule-table">
            <div className="card-head">
              <h2>Startovka {DISCIPLINE_NAME[d]}</h2>
              <button className="no-print" onClick={() => print(d)}>Tisk</button>
            </div>
            <table className="table">
              <colgroup>
                {d === 'P5' && !printing && <col style={{ width: 68 }} />}
                <col style={{ width: 116 }} /><col style={{ width: 100 }} /><col style={{ width: 146 }} /><col style={{ width: '26%' }} /><col style={{ width: '20%' }} /><col />
              </colgroup>
              <thead>
                <tr>{d === 'P5' && <th className="no-print" />}<th>Start</th><th>Číslo</th><th>Kategorie</th><th>Posádka</th><th>Kormidelník</th><th>Oddíl</th></tr>
              </thead>
              <tbody>
                {rows.map(c => (
                  <tr
                    key={c.startNumber}
                    className={[
                      d === 'P5' && dropTarget === c.startNumber && dragged !== c.startNumber && 'drop-target',
                      clashing.has(c.startNumber!) && 'clash-row',
                    ].filter(Boolean).join(' ') || undefined}
                    {...(d === 'P5' && {
                      draggable: true,
                      onDragStart: () => setDragged(c.startNumber),
                      onDragOver: e => { e.preventDefault(); setDropTarget(c.startNumber) },
                      onDrop: () => dragged !== undefined && dragged !== c.startNumber && move(dragged, c.startNumber!),
                      onDragEnd: () => { setDragged(undefined); setDropTarget(undefined) },
                    })}
                  >
                    {d === 'P5' && (
                      <td className="no-print">
                        <span className="drag-handle" title="Přetažením posunete posádku ve startovním poli a časy se přepočítají (ruční úpravy časů se ztratí)">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <circle cx="8" cy="5" r="2" /><circle cx="16" cy="5" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="8" cy="19" r="2" /><circle cx="16" cy="19" r="2" />
                          </svg>
                        </span>
                      </td>
                    )}
                    <td>
                      <TimeInput
                        value={planned(c, d)!}
                        // two crews at the same minute on one station: likely a manual edit mistake
                        className={times.filter(t => t === planned(c, d)).length > 1 ? 'clash' : undefined}
                        onChange={time => setPlanned(c.startNumber!, d, time)}
                      />
                    </td>
                    <td><span className="bib">{c.startNumber}</span></td>
                    <td className="secondary">{c.category}</td>
                    <td className="crew-name-cell">{c.crewName}</td>
                    <td className="secondary">
                      <span className="helm">{c.helmsman}{clashing.has(c.startNumber!) && <span className="badge badge-danger no-print">střet</span>}</span>
                    </td>
                    <td className="secondary">{c.club}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </section>
  )
}

/** 24-hour "HH:MM" field; native time inputs follow the OS locale and may show AM/PM. */
function TimeInput({ value, onChange, className }: { value: string; onChange: (time: string) => void; className?: string }) {
  return (
    <input
      key={value} defaultValue={value} className={`time ${className ?? ''}`} inputMode="numeric" maxLength={5} required
      pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]" title="Čas ve formátu 24 h, např. 10:30"
      onBlur={e => {
        const input = e.currentTarget
        if (!input.checkValidity()) return input.reportValidity()
        const time = input.value.padStart(5, '0')
        if (time !== value) onChange(time)
      }}
      onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}
