import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const VARIANTS = {
  success: { icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  error: { icon: AlertCircle, className: 'border-rose-200 bg-rose-50 text-rose-900' },
  warning: { icon: AlertTriangle, className: 'border-amber-200 bg-amber-50 text-amber-900' },
  info: { icon: Info, className: 'border-sky-200 bg-sky-50 text-sky-900' },
}

const MAX_VISIBLE = 4
let nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
  }, [])

  const show = useCallback(
    (message, { variant = 'info', duration = 5000 } = {}) => {
      if (!message) return null
      const id = ++nextId
      setToasts((current) =>
        current.some((toast) => toast.message === message && toast.variant === variant)
          ? current
          : [...current.slice(-(MAX_VISIBLE - 1)), { id, message, variant }],
      )
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration))
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const api = useMemo(
    () => ({
      show,
      dismiss,
      success: (message, options) => show(message, { ...options, variant: 'success' }),
      error: (message, options) => show(message, { ...options, variant: 'error' }),
      warning: (message, options) => show(message, { ...options, variant: 'warning' }),
      info: (message, options) => show(message, { ...options, variant: 'info' }),
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col gap-2 p-4 sm:inset-x-auto sm:top-0 sm:right-0 sm:bottom-auto sm:w-96"
      >
        {toasts.map(({ id, message, variant }) => {
          const { icon: Icon, className } = VARIANTS[variant] ?? VARIANTS.info
          return (
            <div
              key={id}
              role={variant === 'error' ? 'alert' : 'status'}
              data-cy={`toast-${variant}`}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${className}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <p className="min-w-0 flex-1 break-words">{message}</p>
              <button
                type="button"
                onClick={() => dismiss(id)}
                className="-m-1 rounded-lg p-1 opacity-70 hover:opacity-100"
                aria-label="Cerrar notificación"
              >
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
