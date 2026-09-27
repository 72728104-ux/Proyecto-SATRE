import { useId } from 'react'

/**
 * `as` admite 'input' | 'select' | 'textarea'. `error` acepta el valor de `fieldErrors[name]` de useMutation.
 */
export default function Field({ label, name, error, hint, as: Control = 'input', className = '', id, children, ...props }) {
  const autoId = useId()
  const fieldId = id ?? `${name ?? 'field'}-${autoId}`
  const message = Array.isArray(error) ? error[0] : error
  const describedBy = message ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
  const tone = message ? 'border-rose-300 ring-rose-400' : 'border-slate-200 ring-teal-500'

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">
          {label}
          {props.required ? <span className="text-rose-500"> *</span> : null}
        </label>
      ) : null}
      <Control
        id={fieldId}
        name={name}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy}
        className={`mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 disabled:bg-slate-50 ${tone}`}
        {...props}
      >
        {children}
      </Control>
      {message ? (
        <p id={`${fieldId}-error`} className="mt-1 text-xs text-rose-600">
          {message}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
