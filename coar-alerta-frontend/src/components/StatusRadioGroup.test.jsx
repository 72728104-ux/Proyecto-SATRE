import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StatusRadioGroup from './StatusRadioGroup'

afterEach(cleanup)

const options = {
  present: { label: 'Presente' },
  late: { label: 'Tardanza' },
  absent_unjustified: { label: 'Falta' },
  on_permission: { label: 'Con permiso' },
}

const renderGroup = (props = {}) =>
  render(<StatusRadioGroup options={options} value={{ status: 'present' }} onChange={vi.fn()} ariaLabel="Estado de asistencia" {...props} />)

describe('StatusRadioGroup', () => {
  it('expone un radiogroup accesible con la opción activa', () => {
    renderGroup()

    expect(screen.getByRole('radiogroup', { name: 'Estado de asistencia' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Presente' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Tardanza' }).getAttribute('aria-checked')).toBe('false')
  })

  it('notifica el estado seleccionado', () => {
    const onChange = vi.fn()
    renderGroup({ onChange })

    fireEvent.click(screen.getByRole('radio', { name: 'Falta' }))
    expect(onChange).toHaveBeenCalledWith({ status: 'absent_unjustified' })
  })

  it('aplica el data-cy por estado', () => {
    renderGroup({ dataCy: 'asistencia' })

    expect(screen.getByRole('radio', { name: 'Con permiso' }).getAttribute('data-cy')).toBe('asistencia-on_permission')
  })

  it('marca visualmente cada estado activo conocido', () => {
    const { rerender } = renderGroup({ value: { status: 'late' } })
    expect(screen.getByRole('radio', { name: 'Tardanza' }).className).toContain('bg-amber-500')

    rerender(
      <StatusRadioGroup options={options} value={{ status: 'absent_unjustified' }} onChange={vi.fn()} ariaLabel="Estado" />,
    )
    expect(screen.getByRole('radio', { name: 'Falta' }).className).toContain('bg-rose-600')

    rerender(<StatusRadioGroup options={options} value={{ status: 'on_permission' }} onChange={vi.fn()} ariaLabel="Estado" />)
    expect(screen.getByRole('radio', { name: 'Con permiso' }).className).toContain('bg-sky-600')
  })

  it('usa un layout compacto de tres columnas', () => {
    renderGroup({ compact: true })

    expect(screen.getByRole('radiogroup').className).toContain('grid-cols-3')
    expect(screen.getByRole('radio', { name: 'Presente' }).className).toContain('min-h-11')
  })

  it('omite data-cy cuando no se entrega', () => {
    renderGroup()

    expect(screen.getByRole('radio', { name: 'Presente' }).hasAttribute('data-cy')).toBe(false)
  })
})
