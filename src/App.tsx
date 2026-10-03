import { useState } from 'react'
import { CrewsScreen } from './CrewsScreen.tsx'
import { useAppState } from './store.ts'

const TABS = { crews: 'Posádky' } as const

export default function App() {
  const [state, setState] = useAppState()
  const [tab, setTab] = useState<keyof typeof TABS>('crews')
  return (
    <>
      <nav>
        {Object.entries(TABS).map(([key, label]) => (
          <button key={key} aria-current={tab === key} onClick={() => setTab(key as keyof typeof TABS)}>{label}</button>
        ))}
      </nav>
      {tab === 'crews' && <CrewsScreen state={state} setState={setState} />}
    </>
  )
}
