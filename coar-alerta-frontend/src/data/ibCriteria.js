export const CRITERIA = ['A', 'B', 'C', 'D']

/** Rúbrica pedagógica A–D (TOBE-4). El tooltip incorpora el curso seleccionado. */
export const CRITERION_META = {
  A: {
    letter: 'A',
    short: 'Conocimiento y Comprensión',
    filterLabel: 'Criterio A - Conocimiento y Comprensión',
    description: 'Conocimiento y comprensión conceptual.',
  },
  B: {
    letter: 'B',
    short: 'Investigación',
    filterLabel: 'Criterio B - Investigación',
    description: 'Investigación de patrones y análisis.',
  },
  C: {
    letter: 'C',
    short: 'Comunicación',
    filterLabel: 'Criterio C - Comunicación',
    description: 'Comunicación y expresión matemática/académica.',
  },
  D: {
    letter: 'D',
    short: 'Aplicación Real',
    filterLabel: 'Criterio D - Aplicación Real',
    description: 'Aplicación en contextos del mundo real.',
  },
}

export const CRITERIA_LEGEND =
  'La evaluación desglosada por Criterio (A-D) permite a la IA detectar la competencia exacta que el estudiante necesita reforzar.'

export function criterionMeta(letter) {
  return CRITERION_META[letter] ?? null
}

export function criterionFilterLabel(letter) {
  return criterionMeta(letter)?.filterLabel ?? `Criterio ${letter}`
}

/** Texto del tooltip para una letra; incluye el curso cuando está seleccionado. */
export function criterionTooltip(letter, courseName) {
  const meta = criterionMeta(letter)
  if (!meta) return ''
  const meaning = `Criterio ${letter}: ${meta.description}`
  const course = String(courseName ?? '').trim()
  return course ? `${course} · ${meaning}` : meaning
}

export function criteriaCatalog(courseName) {
  const course = String(courseName ?? '').trim()
  const heading = course ? `Criterios A–D · ${course}` : 'Criterios A–D'
  const lines = CRITERIA.map((letter) => {
    const meta = CRITERION_META[letter]
    return `${letter} — ${meta.description}`
  })
  return [heading, ...lines].join('\n')
}
