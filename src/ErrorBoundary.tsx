import { Component, type ReactNode } from 'react'

/** Never a blank page on race day: show the error and a way back. Data stay in localStorage. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <section role="alert">
        <h1>Appka narazila na chybu</h1>
        <p>Data jsou uložená v tomto prohlížeči a nic se neztratilo.</p>
        <p><button className="btn-primary btn-xl" onClick={() => location.reload()}>Načíst znovu</button></p>
        <pre>{String(this.state.error.stack ?? this.state.error)}</pre>
      </section>
    )
  }
}
