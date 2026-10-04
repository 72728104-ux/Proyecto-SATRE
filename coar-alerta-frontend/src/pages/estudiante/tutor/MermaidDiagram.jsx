import { useEffect, useId, useState } from 'react'

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
      })
      return mermaid
    })
  }
  return mermaidLoader
}

export default function MermaidDiagram({ chart }) {
  const reactId = useId().replace(/:/g, '')
  const source = String(chart || '').trim()
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
  if (ready.failed) {
    return <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{source}</pre>
  }
  return (
    <div
      className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3"
      data-cy="tutor-mermaid"
      dangerouslySetInnerHTML={{ __html: ready.svg }}
    />
  )
}
