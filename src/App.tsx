import { useState } from 'react'
import { CrewsScreen } from './CrewsScreen.tsx'
import { ScheduleScreen } from './ScheduleScreen.tsx'
import { TimingScreen } from './TimingScreen.tsx'
import { useAppState } from './store.ts'

const TABS = { crews: 'Posádky', schedule: 'Startovka', timing: 'Měření' } as const

export default function App() {
  const [state, setState] = useAppState()
  const [tab, setTab] = useState<keyof typeof TABS>('crews')
  return (
    <>
      <nav className="no-print">
        {Object.entries(TABS).map(([key, label]) => (
          <button key={key} aria-current={tab === key} onClick={() => setTab(key as keyof typeof TABS)}>{label}</button>
        ))}
      </nav>
      {tab === 'crews' && <CrewsScreen state={state} setState={setState} />}
      {tab === 'schedule' && <ScheduleScreen state={state} setState={setState} />}
      {tab === 'timing' && <TimingScreen state={state} setState={setState} />}
    </>
  )
}
