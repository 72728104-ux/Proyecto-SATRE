import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HintActions from './HintActions'
import { TUTOR_INTENTS } from './createProtocol'

afterEach(() => cleanup())

describe('HintActions', () => {
  it('muestra todas las intenciones del tutor y las emite al hacer clic', () => {
    const onIntent = vi.fn()
    render(<HintActions onIntent={onIntent} />)

    const labels = Object.values(TUTOR_INTENTS).map((intent) => intent.label)
    labels.forEach((label) => expect(screen.getByRole('button', { name: label })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: TUTOR_INTENTS.hint.label }))
    expect(onIntent).toHaveBeenCalledWith(TUTOR_INTENTS.hint)
  })

  it('deshabilita los botones mientras el tutor responde', () => {
    const onIntent = vi.fn()
    render(<HintActions disabled onIntent={onIntent} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(Object.keys(TUTOR_INTENTS).length)
    buttons.forEach((button) => expect(button.disabled).toBe(true))
    fireEvent.click(buttons[0])
    expect(onIntent).not.toHaveBeenCalled()
  })
})
