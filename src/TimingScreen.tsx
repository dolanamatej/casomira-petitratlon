import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { crewDiscipline, type CrewDiscipline } from './domain/crewDiscipline.ts'
import { clockTime, clockToIso, formatDuration, parseWait } from './domain/time.ts'
import { CATEGORIES, DISCIPLINE_NAME, type Category, type Crew, type Discipline, type Event } from './domain/types.ts'
import { deviceLabel, type AppState, type StationOwner } from './store.ts'

interface Props {
  state: AppState
  setState: Dispatch<SetStateAction<AppState>>
  takeover: (discipline: Discipline) => Promise<void>
  claim: (discipline: Discipline) => Promise<StationOwner | undefined>
  /** Station being claimed or taken over right now: two requests to Google, 5–15 s. */
  takingOver?: Discipline
}

async function confirmTakeover(state: AppState, d: Discipline, takeover: Props['takeover']) {
  const owner = state.stations.find(s => s.discipline === d)
  const who = owner ? `${deviceLabel(owner)} (naposledy ${clockTime(owner.lastSeen)})` : 'jiné zařízení'
  if (!confirm(`Stanoviště ${DISCIPLINE_NAME[d]} teď měří ${who}. Převzít ho? To zařízení pak už nebude moct zapisovat.`)) return
  try {
    await takeover(d)
  } catch (err) {
    alert(`Převzetí se nepovedlo, je potřeba připojení k internetu a nastavená záloha.\n${err instanceof Error ? err.message : err}`)
  }
}

const BOAT_LIMIT = 4
const LABEL: Record<Event['type'], string> = { start: 'Start', finish: 'Cíl', wait: 'Čekačka', dnf: 'DNF', void: 'Zrušení' }

/** Start timing a station only once the sheet confirms nobody else times it. */
async function chooseStation(state: AppState, setState: Props['setState'], d: Discipline, claim: Props['claim'], takeover: Props['takeover']) {
  if (!state.backup.url) return setState(s => ({ ...s, discipline: d })) // no sheet, nothing to check against
  try {
    const owner = await claim(d)
    if (!owner) setState(s => ({ ...s, discipline: d })) // script too old to know stations
    else if (owner.deviceId !== state.deviceId) await confirmTakeover({ ...state, stations: [owner] }, d, takeover)
  } catch {
    if (confirm(`Stanoviště ${DISCIPLINE_NAME[d]} se nepodařilo ověřit v tabulce (bez signálu?). Měřit i tak? Pokud ho měří jiné zařízení, budou zapisovat obě, dokud se nespojí.`)) {
      setState(s => ({ ...s, discipline: d }))
    }
  }
}

export function TimingScreen({ state, setState, takeover, claim, takingOver }: Props) {
  if (takingOver) {
    return (
      <section role="status">
        <h1>Ověřuji stanoviště {DISCIPLINE_NAME[takingOver]} v tabulce…</h1>
        <p>Aby stejnou trať neměřila dvě zařízení. Obvykle 5–15 s, při slabém signálu déle.</p>
      </section>
    )
  }
  const discipline = state.discipline
  if (!discipline) {
    return (
      <section>
        <h1>Měření – vyberte stanoviště</h1>
        {(['P5', 'C2'] as const).map(d => {
          const owner = state.stations.find(s => s.discipline === d)
          const other = owner && owner.deviceId !== state.deviceId
          return (
            <p key={d}>
              <button className="big" onClick={() => (other ? confirmTakeover(state, d, takeover) : chooseStation(state, setState, d, claim, takeover))}>
                {DISCIPLINE_NAME[d]}
              </button>
              {other && <> měří {deviceLabel(owner)}, naposledy {clockTime(owner.lastSeen)}</>}
            </p>
          )
        })}
      </section>
    )
  }
  return <Station discipline={discipline} state={state} setState={setState} takeover={takeover} claim={claim} />
}

function Station({ discipline, state, setState, takeover }: Props & { discipline: Discipline }) {
  const owner = state.stations.find(s => s.discipline === discipline)
  // another device took the station over: two devices must never time the same course
  const locked = !!owner && owner.deviceId !== state.deviceId
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const record = (e: Pick<Event, 'startNumber' | 'type'> & Partial<Event>) => {
    const at = new Date().toISOString()
    const event: Event = { id: crypto.randomUUID(), discipline, timestamp: at, deviceId: state.deviceId, createdAt: at, ...e }
    setState(s => ({ ...s, events: [...s.events, event] }))
  }

  const planned = (c: Crew) => (discipline === 'P5' ? c.plannedStartP5 : c.plannedStartC2)
  // station order; extra crews without a planned start go last
  const crews = state.crews
    .filter(c => c.startNumber !== undefined)
    .sort((a, b) => (planned(a) ?? '99').localeCompare(planned(b) ?? '99') || a.startNumber! - b.startNumber!)
    .map(crew => ({ crew, d: crewDiscipline(state.events, crew.startNumber!, discipline) }))
  const waiting = crews.filter(x => x.d.status === 'waiting')
  const onCourse = crews.filter(x => x.d.status === 'onCourse')
  const done = crews.filter(x => x.d.status === 'finished' || x.d.status === 'out')

  const voided = new Set(state.events.filter(e => e.type === 'void').map(e => e.voidsEventId))
  const lastAction = state.events.findLast(e => e.deviceId === state.deviceId && e.discipline === discipline && e.type !== 'void' && !voided.has(e.id))
  function undo() {
    if (!lastAction) return
    if (confirm(`Vrátit: ${LABEL[lastAction.type]} posádky ${lastAction.startNumber}?`)) {
      record({ startNumber: lastAction.startNumber, type: 'void', voidsEventId: lastAction.id })
    }
  }

  const row = ({ crew, d }: { crew: Crew; d: CrewDiscipline }, action: ReactNode, isNext = false) => (
    <tr key={crew.startNumber} className={isNext ? 'next' : undefined}>
      <td className="num">{crew.startNumber}</td>
      <td>{crew.crewName}<br /><small>{crew.helmsman} · {crew.category}</small></td>
      <td>{planned(crew) ?? '—'}</td>
      <td>{action}</td>
      <td><CrewDetail crew={crew} d={d} discipline={discipline} events={state.events} record={record} /></td>
    </tr>
  )

  return (
    <section>
      <h1>
        Měření {DISCIPLINE_NAME[discipline]}{' '}
        <small><button onClick={() => confirm('Změnit stanoviště tohoto notebooku?') && setState(s => ({ ...s, discipline: undefined }))}>změnit</button></small>
      </h1>
      <div className="clock">{new Date(now).toTimeString().slice(0, 8)}</div>
      {locked && (
        <div role="alert" className="locked">
          <strong>Stanoviště převzalo jiné zařízení: {deviceLabel(owner)}</strong> (naposledy {clockTime(owner.lastSeen)}).
          Tady už nejde zapisovat.{' '}
          <button onClick={() => confirmTakeover(state, discipline, takeover)}>Převzít zpět</button>
        </div>
      )}
      <fieldset disabled={locked} className="plain">
      <p className="toolbar">
        <span className={onCourse.length > BOAT_LIMIT ? 'over-limit' : undefined}>Na trati: <strong>{onCourse.length}/{BOAT_LIMIT}</strong></span>
        <button onClick={undo} disabled={!lastAction}>↶ Zpět{lastAction && `: ${LABEL[lastAction.type]} ${lastAction.startNumber}`}</button>
        <ExtraCrew state={state} setState={setState} />
      </p>

      <h2>Na trati ({onCourse.length})</h2>
      <table className="timing"><tbody>
        {onCourse.map(x => row(x, <>
          <span className="running">{formatDuration((now - Date.parse(x.d.start!.timestamp)) / 1000)}</span>{' '}
          <button className="big finish" onClick={() => record({ startNumber: x.crew.startNumber!, type: 'finish' })}>Cíl</button>
        </>))}
      </tbody></table>

      <h2>Čeká ({waiting.length})</h2>
      <table className="timing"><tbody>
        {waiting.map((x, i) => row(x,
          <button className="big start" onClick={() => record({ startNumber: x.crew.startNumber!, type: 'start' })}>Start</button>,
          i === 0,
        ))}
      </tbody></table>

      <h2>Dojela ({done.length})</h2>
      <table className="timing"><tbody>
        {done.map(x => row(x, x.d.status === 'out'
          ? <strong>DNF</strong>
          : <>
              {formatDuration(x.d.seconds!)}
              {discipline === 'P5' && <WaitInput d={x.d} onChange={waitSeconds => record({ startNumber: x.crew.startNumber!, type: 'wait', waitSeconds })} />}
            </>,
        ))}
      </tbody></table>
      </fieldset>
    </section>
  )
}

/** Wait from the P5 card, m:ss. Every change is a new wait event; the latest counts. */
function WaitInput({ d, onChange }: { d: CrewDiscipline; onChange: (seconds: number) => void }) {
  const current = d.waitSeconds ? formatDuration(d.waitSeconds).replace(/^0:/, '') : ''
  return (
    <label className="wait">
      {' '}čekačka{' '}
      <input
        key={current} defaultValue={current} placeholder="m:ss" size={5}
        onBlur={e => {
          const seconds = parseWait(e.currentTarget.value)
          e.currentTarget.setCustomValidity(seconds === undefined ? 'Zadejte čekačku jako m:ss, např. 4:20' : '')
          if (seconds === undefined) return e.currentTarget.reportValidity()
          if (seconds !== d.waitSeconds) onChange(seconds)
        }}
        onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </label>
  )
}

/** Corrections, DNF and voiding any of the crew's events. */
function CrewDetail({ crew, d, discipline, events, record }: {
  crew: Crew; d: CrewDiscipline; discipline: Discipline; events: Event[]
  record: (e: Pick<Event, 'startNumber' | 'type'> & Partial<Event>) => void
}) {
  const startNumber = crew.startNumber!
  const voided = new Set(events.filter(e => e.type === 'void').map(e => e.voidsEventId))
  const mine = events.filter(e => e.startNumber === startNumber && e.discipline === discipline && e.type !== 'void')

  function correct(type: 'start' | 'finish') {
    const current = type === 'start' ? d.start : d.finish
    const text = prompt(`Opravit ${LABEL[type].toLowerCase()} posádky ${startNumber} (HH:MM:SS)`, current ? clockTime(current.timestamp) : '')
    if (text === null) return
    const timestamp = clockToIso(text, current?.timestamp ?? new Date().toISOString())
    if (!timestamp) return alert('Čas musí být ve formátu HH:MM:SS, např. 10:30:05')
    record({ startNumber, type, timestamp })
  }

  return (
    <details>
      <summary>Upravit</summary>
      <p>
        <button onClick={() => correct('start')}>Opravit start</button>{' '}
        {d.start && <button onClick={() => correct('finish')}>Opravit cíl</button>}{' '}
        {d.status !== 'out' && (
          <button onClick={() => confirm(`Posádka ${startNumber} nedokončila (DNF)?`) && record({ startNumber, type: 'dnf' })}>DNF</button>
        )}
      </p>
      <ul>
        {mine.map(e => (
          <li key={e.id} className={voided.has(e.id) ? 'voided' : undefined}>
            {LABEL[e.type]} {e.type === 'wait' ? formatDuration(e.waitSeconds ?? 0) : e.type === 'start' || e.type === 'finish' ? clockTime(e.timestamp) : ''}
            {!voided.has(e.id) && (
              <button onClick={() => confirm(`Zrušit ${LABEL[e.type].toLowerCase()} posádky ${startNumber}?`) && record({ startNumber, type: 'void', voidsEventId: e.id })}>zrušit</button>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}

/** Crew formed during the race; organizers give it a number and both stations enter the same one. */
function ExtraCrew({ state, setState }: Pick<Props, 'state' | 'setState'>) {
  const [open, setOpen] = useState(false)
  if (!open) return <button onClick={() => setOpen(true)}>+ Posádka navíc</button>
  return (
    <form
      className="extra-crew"
      onSubmit={e => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        const startNumber = Number(f.get('startNumber'))
        const existing = state.crews.find(c => c.startNumber === startNumber)
        // the other station may have synced it in already: same number means the same crew
        if (existing && !confirm(`Číslo ${startNumber} už má posádka „${existing.crewName}“. Je to ona?`)) return
        if (!existing) {
          const crew: Crew = { startNumber, category: f.get('category') as Category, crewName: String(f.get('crewName')), helmsman: String(f.get('helmsman')), club: '' }
          setState(s => ({ ...s, crews: [...s.crews, crew] }))
        }
        setOpen(false)
      }}
    >
      <input name="startNumber" type="number" min={1} placeholder="Číslo" required className="number" autoFocus />
      <select name="category" defaultValue="OPEN">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
      <input name="crewName" placeholder="Posádka" required />
      <input name="helmsman" placeholder="Kormidelník" />
      <button>Přidat</button> <button type="button" onClick={() => setOpen(false)}>Zrušit</button>
    </form>
  )
}
