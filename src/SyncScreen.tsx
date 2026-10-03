import { useState, type Dispatch, type SetStateAction } from 'react'
import type { BackupStatus } from './backup.ts'
import { mergeRemote } from './domain/sync.ts'
import { clockTime } from './domain/time.ts'
import { DISCIPLINE_NAME } from './domain/types.ts'
import { WarningIcon } from './icons.tsx'
import { deviceLabel, type AppState } from './store.ts'

interface Props {
  state: AppState
  setState: Dispatch<SetStateAction<AppState>>
  status: BackupStatus
  push: () => Promise<unknown>
  pull: () => Promise<unknown>
  resetStatus: () => void
}

export function SyncScreen({ state, setState, status, push, pull, resetStatus }: Props) {
  const [message, setMessage] = useState('')

  async function run(label: string, action: () => Promise<unknown>) {
    setMessage(`${label}…`)
    try {
      await action()
      setMessage(`${label}: hotovo`)
    } catch (err) {
      setMessage(`${label} selhalo: ${err instanceof Error ? err.message : err}`)
    }
  }

  function exportJson() {
    // crews and events only: the token stays in this browser
    const blob = new Blob([JSON.stringify({ crews: state.crews, events: state.events }, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `casomira-${state.discipline ?? 'hlavni'}-${new Date().toTimeString().slice(0, 5).replace(':', '')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function importJson(file: File) {
    const data = JSON.parse(await file.text())
    if (!Array.isArray(data.crews) || !Array.isArray(data.events)) throw new Error('Soubor není export časomíry')
    // the snapshot stays as it was, so imported changes count as unsent and go to the sheet
    setState(s => ({ ...s, ...mergeRemote(s, data, s.snapshot), snapshot: s.snapshot }))
  }

  return (
    <section>
      <div className="page-head"><h1>Synchronizace</h1></div>
      {message && <p role="status" className="message">{message}</p>}

      <div className="sync-grid">
        <section className="card card-pad section">
          <h2>Záloha do Google tabulky</h2>
          {!status.configured
            ? <div role="alert" className="alert alert-compact"><WarningIcon size={22} /><span className="alert-title">Záloha není nastavená.</span></div>
            : status.error
              ? <div role="alert" className="alert alert-compact"><WarningIcon size={22} /><span><span className="alert-title">Neodesláno: {status.pending}</span>{status.lastOk && <>, naposledy odesláno {status.lastOk.toTimeString().slice(0, 8)}</>} – chyba: {status.error}</span></div>
              : <p className="status-line">Neodesláno: <strong>{status.pending}</strong>{status.lastOk && <>, naposledy odesláno {status.lastOk.toTimeString().slice(0, 8)}</>}</p>}
          {!!status.casovkaWarnings?.length && (
            <div role="alert" className="alert">
              <WarningIcon />
              <div>
                <div className="alert-title">Data jsou zálohovaná, ale:</div>
                <ul>{status.casovkaWarnings.map(w => <li key={w}>{w}</li>)}</ul>
              </div>
            </div>
          )}
          <form
            className="section"
            onSubmit={e => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              setState(s => ({ ...s, backup: { url: String(f.get('url')).trim(), token: String(f.get('token')).trim() } }))
              setMessage('Nastavení uloženo')
            }}
          >
            <label className="field">URL Apps Scriptu <input name="url" defaultValue={state.backup.url} placeholder="https://script.google.com/macros/s/…/exec" /></label>
            <div className="token-row">
              <label className="field">Token <input name="token" type="password" defaultValue={state.backup.token} /></label>
              <button className="btn-primary">Uložit</button>
            </div>
          </form>
          <div className="section-part">
            <div className="row">
              <button disabled={!status.configured || !status.pending} onClick={() => run('Odeslání', push)}>Odeslat teď</button>
              <button disabled={!status.configured} onClick={() => run('Stažení z tabulky', pull)}>Stáhnout z tabulky</button>
            </div>
            <p className="help">Stažení načte posádky, startovku a události druhého stanoviště. Na novém notebooku tím obnovíte celý stav.</p>
          </div>
          <div className="section-part">
            <div>
              <button
                disabled={!status.configured}
                onClick={() => confirm('Odeslat do tabulky znovu všechny posádky, události a časovku tohoto stanoviště?')
                  // forgetting what was sent makes everything pending; the script skips events it already has
                  && (resetStatus(), setState(s => ({ ...s, sentIds: [], snapshot: {} })))}
              >
                Odeslat vše znovu
              </button>
            </div>
            <p className="help">Když v tabulce něco chybí nebo bylo smazané. Duplicity nevzniknou.</p>
          </div>
        </section>

        <div className="stack">
          <section className="card card-pad section">
            <h2>Stanoviště</h2>
            <div className="field-group">
              <label className="field">Název tohoto zařízení
                <input defaultValue={state.deviceName} placeholder="např. Notebook Matěj" onBlur={e => {
                  const deviceName = e.currentTarget.value.trim()
                  setState(s => ({ ...s, deviceName }))
                }} />
              </label>
              <p className="help">Ostatní ho uvidí v přehledu níže.</p>
            </div>
            {state.stations.length ? (
              <div className="card">
                <table className="table">
                  <thead><tr><th>Stanoviště</th><th>Měří</th><th>Od</th><th>Naposledy</th></tr></thead>
                  <tbody>
                    {state.stations.map(s => (
                      <tr key={s.discipline}>
                        <td>{DISCIPLINE_NAME[s.discipline]}</td>
                        <td>{deviceLabel(s)}{s.deviceId === state.deviceId && <strong> (toto zařízení)</strong>}</td>
                        <td>{clockTime(s.since)}</td>
                        <td>{clockTime(s.lastSeen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="status-line">Zatím žádné stanoviště není v tabulce přiřazené.</p>}
            <p className="help">Stanoviště převezmete na obrazovce Měření. Přehled se obnovuje při každé synchronizaci.</p>
          </section>

          <section className="card card-pad section">
            <h2>Soubor</h2>
            <div className="row">
              <button onClick={exportJson}>Exportovat JSON</button>
              <label className="file-button">
                Importovat JSON <input type="file" accept=".json,application/json" onChange={e => e.target.files?.[0] && run('Import', () => importJson(e.target.files![0]))} />
              </label>
            </div>
            <p className="help">Import se sloučí s tím, co už notebook má. Nic se nepřepíše ani nesmaže.</p>
          </section>
        </div>
      </div>

      <section className="card card-pad danger-card">
        <div>
          <h2>Smazání dat</h2>
          <p>Tabulku to nemaže. Pokud chcete data zachovat, nejdřív je exportujte.</p>
        </div>
        <button
          className="btn-danger"
          onClick={() => {
            if (prompt('Smaže z tohoto notebooku všechny posádky, startovku a časy (např. po zkoušce nanečisto). Nastavení zálohy zůstane. Pro potvrzení napište SMAZAT') !== 'SMAZAT') return
            setState(s => ({ ...s, crews: [], events: [], sentIds: [], snapshot: {}, discipline: undefined }))
            resetStatus()
            setMessage('Data smazána')
          }}
        >
          Smazat všechna data v tomto notebooku
        </button>
      </section>
    </section>
  )
}
