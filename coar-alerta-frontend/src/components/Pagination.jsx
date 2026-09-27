import { ChevronLeft, ChevronRight } from 'lucide-react'

const pageWindow = (page, last) => {
  const pages = new Set([1, last, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b)
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['gap-' + p, p] : [p]))
}

const buttonClass =
  'inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:border-teal-400 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * `meta` es el bloque de paginación de Laravel: current_page, last_page, total, from, to.
 */
export default function Pagination({ meta, onPageChange, disabled = false }) {
  if (!meta || !meta.last_page || meta.last_page <= 1) return null
  const { current_page: page, last_page: last, total, from, to } = meta
  const go = (target) => {
    if (target !== page && target >= 1 && target <= last) onPageChange(target)
  }

  return (
    <nav aria-label="Paginación" className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-xs text-slate-500">
        Mostrando {from ?? '–'}–{to ?? '–'} de {total}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className={buttonClass} disabled={disabled || page <= 1} onClick={() => go(page - 1)}>
          <ChevronLeft size={16} />
          <span className="sr-only sm:not-sr-only">Anterior</span>
        </button>

        <span className="px-3 text-sm text-slate-600 sm:hidden">
          Página {page} de {last}
        </span>

        <div className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, last).map((p) =>
            typeof p === 'string' ? (
              <span key={p} className="px-1 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                disabled={disabled}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => go(p)}
                className={`${buttonClass} ${p === page ? 'border-navy-900 bg-navy-900 text-white hover:border-navy-900' : ''}`}
              >
                {p}
              </button>
            ),
          )}
        </div>

        <button type="button" className={buttonClass} disabled={disabled || page >= last} onClick={() => go(page + 1)}>
          <span className="sr-only sm:not-sr-only">Siguiente</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  )
}
