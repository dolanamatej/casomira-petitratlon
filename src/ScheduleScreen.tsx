import { useState, type Dispatch, type SetStateAction } from 'react'
import { generateSchedule, helmsmanClashes, scheduleStats } from './domain/schedule.ts'
import type { Crew, Discipline } from './domain/types.ts'
import type { AppState } from './store.ts'

interface Props {
  state: AppState
  setState: Dispatch<SetStateAction<AppState>>
}

const BOAT_LIMIT = 4
const MIN_REST = 30
const planned = (c: Crew, d: Discipline) => (d === 'P5' ? c.plannedStartP5 : c.plannedStartC2)

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

  return (
    <section>
      <h1 className="no-print">Startovka</h1>
      <fieldset className="no-print">
        <label>Začátek <TimeInput value={firstStart} onChange={setFirstStart} /></label>{' '}
        <label>Rozestup <input type="number" min={1} className="number" value={intervalMinutes} onChange={e => setIntervalMinutes(Number(e.target.value) || 1)} /> min</label>{' '}
        (doporučeno 8)
        <p>
          {registered.length} registrovaných posádek: poslední start <strong>{stats.lastStart}</strong>, odhad konce <strong>{stats.estimatedEnd}</strong>.
          Na trati typicky {stats.typicalOnCourse.P5.toFixed(1)} pramic a {stats.typicalOnCourse.C2.toFixed(1)} kánoí.
          Odpočinek mezi disciplínami nejméně {stats.minRestMinutes} min.
        </p>
        {stats.typicalOnCourse.P5 > BOAT_LIMIT && <p role="alert">Na trati bude typicky víc než {BOAT_LIMIT} pramice.</p>}
        {stats.typicalOnCourse.C2 > BOAT_LIMIT && <p role="alert">Na trati bude typicky víc než {BOAT_LIMIT} kánoe.</p>}
        {registered.length > 1 && stats.minRestMinutes < MIN_REST && <p role="alert">Nejpomalejší posádka bude mít mezi disciplínami méně než {MIN_REST} min.</p>}
        <button onClick={generate} disabled={!registered.length}>Vygenerovat startovku</button>
      </fieldset>
      {helmsmanClashes(registered).map(({ helmsman, startNumbers: [a, b], shortMinutes }) => (
        <p role="alert" className="no-print" key={`${a}-${b}`}>
          Kormidelník {helmsman} řídí posádky {a} a {b}: pozdější jízda by musela startovat o {shortMinutes} min později. Přetáhněte jednu z nich jinam.
        </p>
      ))}

      {(['P5', 'C2'] as const).map(d => {
        const rows = registered.filter(c => planned(c, d)).sort((a, b) => planned(a, d)!.localeCompare(planned(b, d)!))
        const times = rows.map(c => planned(c, d))
        if (!rows.length || (printing && printing !== d)) return null
        return (
          <div key={d} className="station">
            <h2>Startovka {d === 'P5' ? 'pramice (P5)' : 'kánoe (C2)'} <button className="no-print" onClick={() => print(d)}>Tisk</button></h2>
            <table>
              <thead>
                <tr>{d === 'P5' && <th className="no-print" />}<th>Plán</th><th>Číslo</th><th>Kategorie</th><th>Posádka</th><th>Kormidelník</th><th>Oddíl</th></tr>
              </thead>
              <tbody>
                {rows.map(c => (
                  <tr
                    key={c.startNumber}
                    className={d === 'P5' && dropTarget === c.startNumber && dragged !== c.startNumber ? 'drop-target' : undefined}
                    {...(d === 'P5' && {
                      draggable: true,
                      onDragStart: () => setDragged(c.startNumber),
                      onDragOver: e => { e.preventDefault(); setDropTarget(c.startNumber) },
                      onDrop: () => dragged !== undefined && dragged !== c.startNumber && move(dragged, c.startNumber!),
                      onDragEnd: () => { setDragged(undefined); setDropTarget(undefined) },
                    })}
                  >
                    {d === 'P5' && (
                      <td className="no-print drag-handle" title="Přetažením posunete posádku ve startovním poli a časy se přepočítají (ruční úpravy časů se ztratí)">⠿</td>
                    )}
                    <td>
                      <TimeInput
                        value={planned(c, d)!}
                        // two crews at the same minute on one station: likely a manual edit mistake
                        className={times.filter(t => t === planned(c, d)).length > 1 ? 'clash' : undefined}
                        onChange={time => setPlanned(c.startNumber!, d, time)}
                      />
                    </td>
                    <td>{c.startNumber}</td><td>{c.category}</td><td>{c.crewName}</td><td>{c.helmsman}</td><td>{c.club}</td>
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
