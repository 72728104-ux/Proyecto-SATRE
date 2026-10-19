import { CircleHelp } from 'lucide-react'
import { criteriaCatalog, criterionTooltip } from '../data/ibCriteria'
import Tooltip from './Tooltip'

export function CriterionHelp({ courseName }) {
  return (
    <Tooltip content={criteriaCatalog(courseName)}>
      <button
        type="button"
        data-cy="criterion-help"
        className="inline-flex rounded-full text-slate-400 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        aria-label="Qué significan los criterios A–D"
      >
        <CircleHelp size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}

export function CriterionLetter({ letter, courseName }) {
  if (!letter) return '—'
  return (
    <Tooltip content={criterionTooltip(letter, courseName)}>
      <button
        type="button"
        data-cy="criterion-letter"
        className="cursor-help font-semibold text-navy-950 underline decoration-dotted decoration-slate-300 underline-offset-4"
        aria-label={criterionTooltip(letter, courseName)}
      >
        {letter}
      </button>
    </Tooltip>
  )
}

export function CriterionHeader({ courseName }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      Criterio
      <CriterionHelp courseName={courseName} />
    </span>
  )
}
