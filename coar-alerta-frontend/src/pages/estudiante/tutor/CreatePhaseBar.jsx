import { CREATE_PHASES, phaseMeta } from './createProtocol'

export default function CreatePhaseBar({ phase }) {
  const current = phaseMeta(phase)
  const index = CREATE_PHASES.findIndex((item) => item.id === phase)

  return (
    <div className="space-y-2" data-cy="create-phase-bar">
      <p className="text-xs font-medium text-slate-500">
        Metodología C.R.E.A.T.E.
        {current ? (
          <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-teal-800" data-cy="create-phase-badge">
            Fase: {current.short}
          </span>
        ) : null}
      </p>
      <ol className="grid grid-cols-6 gap-1">
        {CREATE_PHASES.map((item, itemIndex) => {
          const active = item.id === phase
          const done = index >= 0 && itemIndex < index
          return (
            <li key={item.id} className="min-w-0">
              <span
                className={`block h-1.5 rounded-full ${active ? 'bg-teal-600' : done ? 'bg-teal-300' : 'bg-slate-200'}`}
              />
              <span className={`mt-1 hidden truncate text-[10px] sm:block ${active ? 'font-semibold text-teal-800' : 'text-slate-400'}`}>
                {item.label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
