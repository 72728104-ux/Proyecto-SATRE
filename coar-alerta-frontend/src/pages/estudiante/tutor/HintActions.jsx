import { HelpCircle, ListChecks, Workflow } from 'lucide-react'
import { TUTOR_INTENTS } from './createProtocol'

const ICONS = { hint: HelpCircle, diagram: Workflow, quiz: ListChecks }

export default function HintActions({ disabled, onIntent }) {
  return (
    <div className="flex flex-wrap gap-2" data-cy="tutor-intents">
      {Object.values(TUTOR_INTENTS).map((intent) => {
        const Icon = ICONS[intent.id]
        return (
          <button
            key={intent.id}
            type="button"
            disabled={disabled}
            onClick={() => onIntent(intent)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:border-teal-400 hover:bg-teal-50 disabled:opacity-60"
          >
            <Icon size={14} />
            {intent.label}
          </button>
        )
      })}
    </div>
  )
}
