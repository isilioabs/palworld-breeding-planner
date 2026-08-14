import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { PalaxisMark } from '@/components/palaxis-mark'
import { Button } from '@/components/ui/button'
import { getLang } from '@/i18n/lang'

interface Props { children: ReactNode }
interface State { error: Error | null }

const COPY = {
  en: {
    eyebrow: 'Recovery mode',
    title: 'Palaxis needs a quick restart',
    description: 'A file may have changed during an update. Your collection and saved projects are still stored on this device.',
    retry: 'Reload Palaxis',
    home: 'Return home',
  },
  es: {
    eyebrow: 'Modo de recuperacion',
    title: 'Palaxis necesita reiniciarse',
    description: 'Es posible que un archivo haya cambiado durante una actualizacion. Tu coleccion y proyectos siguen guardados en este dispositivo.',
    retry: 'Recargar Palaxis',
    home: 'Volver al inicio',
  },
} as const

/** Evita una pantalla vacia si falla un chunk tras un deploy o un error de UI. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    window.dispatchEvent(new CustomEvent('palaxis:app-error', {
      detail: { message: error.message, componentStack: info.componentStack },
    }))
  }

  render() {
    if (!this.state.error) return this.props.children

    const lang = getLang()
    const copy = COPY[lang]
    const home = lang === 'es' ? '/es' : '/'

    return (
      <main className="app-recovery" role="alert">
        <div className="app-recovery__panel">
          <PalaxisMark className="app-recovery__mark" />
          <span className="app-recovery__eyebrow"><AlertTriangle aria-hidden="true" />{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
          <div className="app-recovery__actions">
            <Button onClick={() => window.location.reload()}><RefreshCw aria-hidden="true" />{copy.retry}</Button>
            <Button variant="outline" onClick={() => window.location.assign(home)}><Home aria-hidden="true" />{copy.home}</Button>
          </div>
        </div>
      </main>
    )
  }
}
