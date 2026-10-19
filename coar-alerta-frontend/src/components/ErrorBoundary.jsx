import { Component } from 'react'
import { AlertCircle } from 'lucide-react'
import EmptyState from './EmptyState'

/**
 * Evita que un error de render (p. ej. JSON incompleto de la IA) deje la pantalla en blanco.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
    this.reset = this.reset.bind(this)
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    this.props.onError?.(error)
  }

  reset() {
    this.setState({ failed: false })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.failed) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <EmptyState
        icon={AlertCircle}
        title={this.props.title ?? 'No se pudo mostrar esta vista.'}
        description={
          this.props.description ??
          'Ocurrió un error al procesar la respuesta. Puedes reintentar sin recargar toda la plataforma.'
        }
        action={
          <button
            type="button"
            data-cy="error-boundary-retry"
            onClick={this.reset}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reintentar
          </button>
        }
      />
    )
  }
}
