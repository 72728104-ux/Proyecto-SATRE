import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TutorQuiz from './TutorQuiz'

afterEach(() => cleanup())

describe('TutorQuiz', () => {
  it('no renderiza nada sin opciones válidas', () => {
    const { container } = render(<TutorQuiz quiz={{ options: [] }} onSelect={vi.fn()} />)
    expect(container.innerHTML).toBe('')

    const invalid = render(
      <TutorQuiz quiz={{ options: [{ id: null, text: 'x' }, { id: 1, text: '  ' }] }} onSelect={vi.fn()} />,
    )
    expect(invalid.container.innerHTML).toBe('')
  })

  it('renderiza la pregunta y emite la opción seleccionada', () => {
    const onSelect = vi.fn()
    render(
      <TutorQuiz
        quiz={{
          question: '¿Cuál es la pendiente?',
          options: [
            { id: 'A', text: '2' },
            { id: 'B', text: '3' },
          ],
        }}
        onSelect={onSelect}
      />,
    )

    expect(screen.getByText('¿Cuál es la pendiente?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /B\).*3/ }))
    expect(onSelect).toHaveBeenCalledWith({ id: 'B', text: '3' })
  })

  it('respeta el estado deshabilitado', () => {
    const onSelect = vi.fn()
    render(<TutorQuiz quiz={{ options: [{ id: 'A', text: '2' }] }} disabled onSelect={onSelect} />)

    const button = screen.getByRole('button', { name: /A\).*2/ })
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onSelect).not.toHaveBeenCalled()
  })
})
