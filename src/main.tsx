import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'

const root = createRoot(document.getElementById('root')!)
const render = (node: ReactNode) => root.render(<StrictMode><ErrorBoundary>{node}</ErrorBoundary></StrictMode>)

// Two tabs would each keep their own copy and save it over the other's in localStorage.
// The tab holding the lock runs the app; another one waits and reloads with fresh data once it closes.
if ('locks' in navigator) {
  navigator.locks.request('casomira', { ifAvailable: true }, lock => {
    if (lock) {
      render(<App />)
      return new Promise(() => {}) // held for the life of the tab
    }
    render(
      <section role="alert" className="card card-pad page">
        <h1>Appka je otevřená v jiné záložce nebo okně</h1>
        <p>Tady nic nezapisujte, data by se přepsala. Zavřete tuto záložku, nebo tu druhou; pak se appka načte tady sama.</p>
      </section>,
    )
    navigator.locks.request('casomira', () => location.reload())
  })
} else render(<App />) // ponytail: browsers without Web Locks run unguarded

// offline start on race day; the dev server would fight with the cache
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js')
