import { useState } from 'react'
import { useBackup, type BackupStatus } from './backup.ts'
import { CrewsScreen } from './CrewsScreen.tsx'
import { ResultsScreen } from './ResultsScreen.tsx'
import { ScheduleScreen } from './ScheduleScreen.tsx'
import { SyncScreen } from './SyncScreen.tsx'
import { TimingScreen } from './TimingScreen.tsx'
import { useAppState } from './store.ts'

const TABS = { crews: 'Posádky', schedule: 'Startovka', timing: 'Měření', results: 'Výsledky', sync: 'Synchronizace' } as const

export default function App() {
  const [state, setState] = useAppState()
  const [tab, setTab] = useState<keyof typeof TABS>('crews')
  const backup = useBackup(state, setState)
  return (
    <>
      <nav className="topbar no-print">
        <div className="tabs">
          {Object.entries(TABS).map(([key, label]) => (
            <button key={key} className="tab" aria-current={tab === key} onClick={() => setTab(key as keyof typeof TABS)}>{label}</button>
          ))}
        </div>
        <BackupBadge status={backup.status} onClick={() => setTab('sync')} />
      </nav>
      <main className="page">
      {tab === 'crews' && <CrewsScreen state={state} setState={setState} />}
      {tab === 'schedule' && <ScheduleScreen state={state} setState={setState} />}
      {tab === 'timing' && <TimingScreen state={state} setState={setState} takeover={backup.takeover} claim={backup.claim} takingOver={backup.takingOver} />}
      {tab === 'results' && <ResultsScreen state={state} />}
      {tab === 'sync' && <SyncScreen state={state} setState={setState} {...backup} />}
      </main>
    </>
  )
}

/** Always visible, so a stalled backup is noticed on the timing screen too. */
function BackupBadge({ status, onClick }: { status: BackupStatus; onClick: () => void }) {
  const [text, kind] = !status.configured
    ? ['Záloha nenastavena', 'warn']
    : status.pending === 0
      ? status.casovkaWarnings?.length ? ['Záloha ✓, ale viz Synchronizace', 'warn'] : ['Záloha ✓', 'ok']
      : status.error
        ? [`Záloha: ${status.pending} neodesláno, bez spojení`, 'warn']
        : [`Záloha: odesílám ${status.pending}…`, 'ok']
  return <button className={`pill ${kind}`} onClick={onClick} title={status.error}>{text}</button>
}
