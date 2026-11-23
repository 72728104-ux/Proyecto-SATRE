import { Component, useEffect, useId, useState } from 'react'
import { sanitizeMermaidChart } from './sanitizeMermaid'

function MermaidFallback() {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
      data-cy="tutor-mermaid-error"
      role="status"
    >
      No se pudo mostrar el diagrama.
    </div>
  )
}

class MermaidErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) return <MermaidFallback />
    return this.props.children
  }
}

let mermaidLoader = null

function loadMermaid() {
  if (!mermaidLoader) {
    mermaidLoader = import('mermaid').then((mod) => {
      const mermaid = mod.default
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'neutral',
        fontFamily: 'inherit',
        suppressErrorRendering: true,
      })
      return mermaid
    })
  }
  return mermaidLoader
}

export default function MermaidDiagram({ chart }) {
  const reactId = useId().replace(/:/g, '')
  const source = sanitizeMermaidChart(chart)
  const [ready, setReady] = useState({ source: '', svg: '', failed: false })

  useEffect(() => {
    if (!source) return undefined
    let cancelled = false
    loadMermaid()
      .then((mermaid) => mermaid.render(`tutor-mermaid-${reactId}-${Date.now()}`, source))
      .then(({ svg }) => {
        if (!cancelled) setReady({ source, svg, failed: false })
      })
      .catch(() => {
        if (!cancelled) setReady({ source, svg: '', failed: true })
      })
    return () => {
      cancelled = true
    }
  }, [source, reactId])

  if (!source) return null
  if (ready.source !== source) {
    return <div className="h-24 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
  }
  if (ready.failed) return <MermaidFallback />
  return (
    <MermaidErrorBoundary>
      <div
        className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3"
        data-cy="tutor-mermaid"
        dangerouslySetInnerHTML={{ __html: ready.svg }}
      />
    </MermaidErrorBoundary>
  )
}
