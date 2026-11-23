import { useEffect, useId } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, title, children, onClose }) {
  const titleId = useId()

  useEffect(() => {
    if (!open || !onClose) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90svh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 id={titleId} className="text-lg font-semibold text-navy-950">
            {title}
          </h3>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  )
}
