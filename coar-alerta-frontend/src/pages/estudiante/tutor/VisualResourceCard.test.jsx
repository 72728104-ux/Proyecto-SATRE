import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import VisualResourceCard from './VisualResourceCard'

afterEach(() => cleanup())

describe('VisualResourceCard', () => {
  it('no renderiza nada sin título', () => {
    const { container } = render(<VisualResourceCard resource={{ description: 'x' }} />)
    expect(container.innerHTML).toBe('')
    const empty = render(<VisualResourceCard />)
    expect(empty.container.innerHTML).toBe('')
  })

  it('muestra título y descripción del recurso', () => {
    render(<VisualResourceCard resource={{ title: 'Recta numérica', description: 'Apoyo visual' }} />)
    expect(screen.getByText('Recta numérica')).toBeTruthy()
    expect(screen.getByText('Apoyo visual')).toBeTruthy()
  })

  it('omite la descripción cuando no existe', () => {
    render(<VisualResourceCard resource={{ title: 'Plano cartesiano' }} />)
    expect(screen.getByText('Plano cartesiano')).toBeTruthy()
    expect(screen.queryByText('Apoyo visual')).toBeNull()
  })
})
