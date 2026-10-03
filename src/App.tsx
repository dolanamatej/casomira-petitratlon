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
      <nav className="no-print">
        {Object.entries(TABS).map(([key, label]) => (
          <button key={key} aria-current={tab === key} onClick={() => setTab(key as keyof typeof TABS)}>{label}</button>
        ))}
        <BackupBadge status={backup.status} onClick={() => setTab('sync')} />
      </nav>
      {tab === 'crews' && <CrewsScreen state={state} setState={setState} />}
      {tab === 'schedule' && <ScheduleScreen state={state} setState={setState} />}
      {tab === 'timing' && <TimingScreen state={state} setState={setState} />}
      {tab === 'results' && <ResultsScreen state={state} />}
      {tab === 'sync' && <SyncScreen state={state} setState={setState} {...backup} />}
    </>
  )
}

/** Always visible, so a stalled backup is noticed on the timing screen too. */
function BackupBadge({ status, onClick }: { status: BackupStatus; onClick: () => void }) {
  const [text, kind] = !status.configured
    ? ['Záloha nenastavena', 'warn']
    : status.pending === 0
      ? status.casovkaWarnings?.length ? ['Záloha ✓, časovka ⚠', 'warn'] : ['Záloha ✓', 'ok']
      : status.error
        ? [`Záloha: ${status.pending} neodesláno, bez spojení`, 'warn']
        : [`Záloha: odesílám ${status.pending}…`, 'ok']
  return <button className={`badge ${kind}`} onClick={onClick} title={status.error}>{text}</button>
}
