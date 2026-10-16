import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { crewDiscipline, type CrewDiscipline } from './domain/crewDiscipline.ts'
import { clockTime, clockToIso, formatDuration, parseWait } from './domain/time.ts'
import { CATEGORIES, DISCIPLINE_NAME, type Category, type Crew, type Discipline, type Event } from './domain/types.ts'
import { WarningIcon } from './icons.tsx'
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
const STATION_TITLE: Record<Discipline, string> = { P5: 'Pramice P550', C2: 'Kánoe C2' }
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
      <section role="status" className="card station-pick">
        <h1>Ověřuji stanoviště {DISCIPLINE_NAME[takingOver]} v tabulce…</h1>
        <p className="muted">Aby stejnou trať neměřila dvě zařízení. Obvykle 5–15 s, při slabém signálu déle.</p>
      </section>
    )
  }
  const discipline = state.discipline
  if (!discipline) {
    return (
      <section className="card station-pick">
        <h1>Měření – vyberte stanoviště</h1>
        {(['P5', 'C2'] as const).map(d => {
          const owner = state.stations.find(s => s.discipline === d)
          const other = owner && owner.deviceId !== state.deviceId
          return (
            <p key={d} className="row">
              <button className="btn-primary btn-xl" onClick={() => (other ? confirmTakeover(state, d, takeover) : chooseStation(state, setState, d, claim, takeover))}>
                {STATION_TITLE[d]}
              </button>
              {other && <span className="muted">měří {deviceLabel(owner)}, naposledy {clockTime(owner.lastSeen)}</span>}
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

  // time column: planned start while waiting, then the running or final time
  const row = ({ crew, d }: { crew: Crew; d: CrewDiscipline }, time: ReactNode, action: ReactNode, isNext = false) => (
    <li key={crew.startNumber} className={isNext ? 'crew-row next' : 'crew-row'}>
      <span className="bib">{crew.startNumber}</span>
      <div className="crew-info">
        {isNext && <div className="eyebrow">Další na startu</div>}
        <div className="crew-name">{crew.crewName}</div>
        <div className="crew-sub">
          {[crew.helmsman, crew.category, d.start ? `start ${clockTime(d.start.timestamp).slice(0, 5)}` : isNext && planned(crew) && `plán ${planned(crew)}`].filter(Boolean).join(' · ')}
        </div>
      </div>
      {time}
      {action}
      <CrewDetail crew={crew} d={d} discipline={discipline} events={state.events} record={record} />
    </li>
  )

  const over = onCourse.length > BOAT_LIMIT
  return (
    <section className="timing">
      <header className="station-bar">
        <div className="station-name">
          <span className="eyebrow">Stanoviště</span>
          <div className="row">
            <h1>{STATION_TITLE[discipline]}</h1>
            <button onClick={() => confirm('Změnit stanoviště tohoto notebooku?') && setState(s => ({ ...s, discipline: undefined }))}>Změnit</button>
          </div>
        </div>
        <div className="row clock-row">
          <div className="clock">{new Date(now).toTimeString().slice(0, 8)}</div>
          <button className="btn-primary btn-xl" disabled={locked} onClick={() => setState(s => ({ ...s, stops: [...s.stops, new Date().toISOString()] }))}>Stopnout čas</button>
        </div>
        <fieldset disabled={locked} className="plain station-actions">
          <span className={over ? 'on-course over-limit' : 'on-course'}>
            <span className="on-course-label">Na trati</span> <strong>{onCourse.length}/{BOAT_LIMIT}</strong>{over && <span>nad limit</span>}
          </span>
          <button onClick={undo} disabled={!lastAction}>Zpět{lastAction && `: ${LABEL[lastAction.type]} ${lastAction.startNumber}`}</button>
          <ExtraCrew state={state} setState={setState} />
        </fieldset>
      </header>
      {locked && (
        <div role="alert" className="alert locked">
          <WarningIcon />
          <div className="alert-body">
            <div>
              <div className="alert-title">Stanoviště převzalo jiné zařízení: {deviceLabel(owner)}</div>
              Naposledy {clockTime(owner.lastSeen)}. Tady už nejde zapisovat.
            </div>
            <div><button onClick={() => confirmTakeover(state, discipline, takeover)}>Převzít zpět</button></div>
          </div>
        </div>
      )}
      <fieldset disabled={locked} className="plain lanes">
        <div className="lane stack">
          {state.stops.length > 0 && (
            <section className="card">
              <CardTitle title="Stopnuté časy" count={state.stops.length} />
              <datalist id="on-course">{onCourse.map(x => <option key={x.crew.startNumber} value={x.crew.startNumber}>{x.crew.crewName}</option>)}</datalist>
              <ul className="crew-list">
                {state.stops.map(at => <StopRow key={at} at={at} crews={crews} record={record} drop={() => setState(s => ({ ...s, stops: s.stops.filter(x => x !== at) }))} />)}
              </ul>
            </section>
          )}
          <section className="card">
            <CardTitle title="Na trati" count={onCourse.length} />
            {onCourse.length ? <ul className="crew-list">
              {onCourse.map(x => row(x,
                <span className="running">{formatDuration((now - Date.parse(x.d.start!.timestamp)) / 1000)}</span>,
                <button className="btn-primary btn-finish" onClick={() => record({ startNumber: x.crew.startNumber!, type: 'finish' })}>Cíl</button>,
              ))}
            </ul> : <p className="empty">Nikdo není na trati.</p>}
          </section>

          <section className="card">
            <CardTitle title="Dojela" count={done.length} />
            {done.length ? <ul className="crew-list">
              {done.map(x => row(x,
                x.d.status === 'out' ? <span className="badge badge-neutral">DNF</span> : <span className="result">{formatDuration(x.d.seconds!)}</span>,
                discipline === 'P5' && x.d.status !== 'out' && <WaitInput d={x.d} onChange={waitSeconds => record({ startNumber: x.crew.startNumber!, type: 'wait', waitSeconds })} />,
              ))}
            </ul> : <p className="empty">Zatím nikdo nedojel. Posádky se tu objeví po stisku Cíl{discipline === 'P5' && ', na P550 s polem pro čekačku'}.</p>}
          </section>
        </div>

        <section className="card lane waiting">
          <CardTitle title="Čeká" count={waiting.length} />
          {waiting.length ? <ul className="crew-list">
            {waiting.map((x, i) => row(x,
              i > 0 && <span className="planned">{planned(x.crew) ?? '—'}</span>,
              <button className={i === 0 ? 'btn-positive btn-start-next' : 'btn-outline-positive btn-start'} onClick={() => record({ startNumber: x.crew.startNumber!, type: 'start' })}>Start</button>,
              i === 0,
            ))}
          </ul> : <p className="empty">Všechny posádky odstartovaly.</p>}
        </section>
      </fieldset>
    </section>
  )
}

function CardTitle({ title, count }: { title: string; count: number }) {
  return <div className="card-head"><h2 className="card-title">{title} <span className="count">{count}</span></h2></div>
}

/** Finish stopped before the number was known: type the number once the crew tells it. */
function StopRow({ at, crews, record, drop }: {
  at: string; crews: { crew: Crew; d: CrewDiscipline }[]; drop: () => void
  record: (e: Pick<Event, 'startNumber' | 'type'> & Partial<Event>) => void
}) {
  const [text, setText] = useState('')
  function assign() {
    const x = crews.find(c => c.crew.startNumber === Number(text))
    if (!x?.d.start) return alert(`Posádka ${text} nemá start na tomto stanovišti.`)
    if (x.d.status === 'finished' && !confirm(`Posádka ${text} už má cíl ${clockTime(x.d.finish!.timestamp)}. Přepsat na ${clockTime(at)}?`)) return
    record({ startNumber: x.crew.startNumber!, type: 'finish', timestamp: at })
    drop()
  }
  return (
    <li className="crew-row">
      <span className="result">{clockTime(at)}</span>
      <form className="row" onSubmit={e => { e.preventDefault(); assign() }}>
        <input type="number" min={1} list="on-course" placeholder="Číslo" required className="number" value={text} onChange={e => setText(e.target.value)} />
        <button className="btn-primary">Zapsat cíl</button>
        <button type="button" onClick={() => confirm(`Zahodit stopnutý čas ${clockTime(at)}?`) && drop()}>Zahodit</button>
      </form>
    </li>
  )
}

/** Wait from the P5 card, m:ss. Every change is a new wait event; the latest counts. */
function WaitInput({ d, onChange }: { d: CrewDiscipline; onChange: (seconds: number) => void }) {
  const current = d.waitSeconds ? formatDuration(d.waitSeconds).replace(/^0:/, '') : ''
  return (
    <label className="wait">
      čekačka
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
function CrewDetail({ crew, d, discipline, events, record: recordEvent }: {
  crew: Crew; d: CrewDiscipline; discipline: Discipline; events: Event[]
  record: (e: Pick<Event, 'startNumber' | 'type'> & Partial<Event>) => void
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  // the panel overlays the rows below, so close it once something is done
  const record: typeof recordEvent = e => {
    recordEvent(e)
    ref.current!.open = false
  }
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

  function voidEvent(e: Event) {
    // a finish without its start would pair with the next start and give a negative time
    const finishes = e.type === 'start' ? mine.filter(f => f.type === 'finish' && !voided.has(f.id)) : []
    if (!confirm(`Zrušit ${LABEL[e.type].toLowerCase()} posádky ${startNumber}?${finishes.length ? ' Zruší se i její cíl.' : ''}`)) return
    for (const f of [e, ...finishes]) record({ startNumber, type: 'void', voidsEventId: f.id })
  }

  return (
    <details ref={ref} className="crew-detail">
      <summary aria-label="Upravit" title="Upravit">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </summary>
      <div className="detail-panel">
      <p className="row">
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
            {' '}{!voided.has(e.id) && (
              <button onClick={() => voidEvent(e)}>zrušit</button>
            )}
          </li>
        ))}
      </ul>
      </div>
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
