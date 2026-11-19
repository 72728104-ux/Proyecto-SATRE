const ACTIVE_TONES = {
  present: 'border-teal-600 bg-teal-600 text-white',
  late: 'border-amber-500 bg-amber-500 text-white',
  absent_justified: 'border-sky-600 bg-sky-600 text-white',
  absent_unjustified: 'border-rose-600 bg-rose-600 text-white',
  absent: 'border-rose-600 bg-rose-600 text-white',
  on_permission: 'border-sky-600 bg-sky-600 text-white',
}

/**
 * Selector de estado accesible basado en radios.
 * `compact` usa tres columnas y objetivos táctiles más altos (residencia).
 */
export default function StatusRadioGroup({ options, value, onChange, ariaLabel, dataCy, compact = false }) {
  const wrapper = compact
    ? 'grid grid-cols-3 gap-1.5 sm:flex sm:gap-2'
    : 'grid grid-cols-2 gap-2'
  const button = compact
    ? 'min-h-11 rounded-xl border px-2 py-2 text-xs font-medium leading-tight sm:min-h-10 sm:px-3 sm:text-sm'
    : 'h-10 rounded-xl border px-3 text-sm font-medium'

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={wrapper}>
      {Object.entries(options).map(([status, meta]) => (
        <button
          key={status}
          type="button"
          role="radio"
          aria-checked={value.status === status}
          data-cy={dataCy ? `${dataCy}-${status}` : undefined}
          onClick={() => onChange({ status })}
          className={`${button} ${value.status === status ? ACTIVE_TONES[status] : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          {meta.label}
        </button>
      ))}
    </div>
  )
}
