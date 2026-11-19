import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Tooltip from './Tooltip'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const rect = (overrides = {}) => ({
  top: 100,
  bottom: 120,
  left: 100,
  right: 150,
  width: 50,
  height: 20,
  x: 100,
  y: 100,
  toJSON: () => {},
  ...overrides,
})

describe('Tooltip', () => {
  it('muestra el contenido al pasar el mouse y lo oculta al salir', () => {
    render(
      <Tooltip content="Texto de ayuda">
        <button type="button">Ayuda</button>
      </Tooltip>,
    )

    expect(screen.queryByRole('tooltip')).toBeNull()

    fireEvent.mouseOver(screen.getByRole('button', { name: 'Ayuda' }))
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.textContent).toBe('Texto de ayuda')
    expect(document.body.contains(tooltip)).toBe(true)

    fireEvent.mouseOut(screen.getByRole('button', { name: 'Ayuda' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('muestra el contenido al enfocar y lo oculta al perder el foco', () => {
    render(
      <Tooltip content="Foco">
        <button type="button">Foco</button>
      </Tooltip>,
    )
    const trigger = screen.getByRole('button', { name: 'Foco' })

    trigger.focus()
    fireEvent.focusIn(trigger)
    expect(screen.getByRole('tooltip').textContent).toBe('Foco')

    trigger.blur()
    fireEvent.focusOut(trigger)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('se coloca encima cuando no hay espacio debajo', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect({ top: 600, bottom: 700 }))
    render(
      <Tooltip content="Arriba">
        <button type="button">Arriba</button>
      </Tooltip>,
    )

    fireEvent.mouseOver(screen.getByRole('button', { name: 'Arriba' }))
    const tooltip = screen.getByRole('tooltip')

    expect(tooltip.style.top).toBe('592px')
    expect(tooltip.style.left).toBe('168px')
    expect(tooltip.className).toContain('-translate-y-full')
  })

  it('se coloca debajo y limita la posición horizontal', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect({ left: 1000, width: 50 }))
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    render(
      <Tooltip content="Abajo">
        <button type="button">Abajo</button>
      </Tooltip>,
    )

    fireEvent.mouseOver(screen.getByRole('button', { name: 'Abajo' }))
    const tooltip = screen.getByRole('tooltip')

    expect(tooltip.style.top).toBe('128px')
    expect(tooltip.style.left).toBe('856px')
    expect(tooltip.className).not.toContain('-translate-y-full')
  })
})
