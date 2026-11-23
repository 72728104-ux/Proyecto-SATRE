import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CriterionHeader, CriterionHelp, CriterionLetter } from './CriterionHint'

afterEach(cleanup)

describe('CriterionHelp', () => {
  it('muestra el catálogo de criterios al hacer hover', () => {
    render(<CriterionHelp courseName="Matemáticas AA" />)

    const help = screen.getByRole('button', { name: /qué significan los criterios/i })
    fireEvent.mouseOver(help)

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.textContent).toContain('Criterios A–D · Matemáticas AA')
    expect(tooltip.textContent).toContain('A — Conocimiento y comprensión conceptual.')
  })

  it('funciona sin curso seleccionado', () => {
    render(<CriterionHelp />)

    fireEvent.mouseOver(screen.getByRole('button', { name: /qué significan los criterios/i }))
    expect(screen.getByRole('tooltip').textContent).toContain('Criterios A–D')
  })
})

describe('CriterionLetter', () => {
  it('muestra la letra y su tooltip con el curso', () => {
    render(<CriterionLetter letter="B" courseName="Biología" />)

    const letter = screen.getByRole('button', { name: /Criterio B/i })
    expect(letter.textContent).toBe('B')

    fireEvent.mouseOver(letter)
    expect(screen.getByRole('tooltip').textContent).toContain('Biología · Criterio B: Investigación de patrones y análisis.')
  })

  it('muestra un guion cuando no hay letra', () => {
    render(<CriterionLetter />)

    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('CriterionHeader', () => {
  it('compone el título con la ayuda', () => {
    render(<CriterionHeader courseName="Historia" />)

    expect(screen.getByText('Criterio')).toBeTruthy()
    expect(screen.getByRole('button', { name: /qué significan los criterios/i })).toBeTruthy()
  })
})
