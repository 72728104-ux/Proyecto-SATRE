import { describe, expect, it } from 'vitest'
import { CRITERIA_LEGEND, criteriaCatalog, criterionFilterLabel, criterionTooltip } from './ibCriteria'

describe('ibCriteria', () => {
  it('expone etiquetas descriptivas para el filtro', () => {
    expect(criterionFilterLabel('A')).toBe('Criterio A - Conocimiento y Comprensión')
    expect(criterionFilterLabel('B')).toBe('Criterio B - Investigación')
    expect(criterionFilterLabel('C')).toBe('Criterio C - Comunicación')
    expect(criterionFilterLabel('D')).toBe('Criterio D - Aplicación Real')
  })

  it('arma un tooltip contextual con el curso seleccionado', () => {
    expect(criterionTooltip('A')).toBe('Criterio A: Conocimiento y comprensión conceptual.')
    expect(criterionTooltip('B', 'Matemáticas AA')).toBe(
      'Matemáticas AA · Criterio B: Investigación de patrones y análisis.',
    )
    expect(criteriaCatalog('Física')).toContain('Criterios A–D · Física')
    expect(criteriaCatalog('Física')).toContain('D — Aplicación en contextos del mundo real.')
    expect(CRITERIA_LEGEND).toContain('competencia exacta')
  })
})
