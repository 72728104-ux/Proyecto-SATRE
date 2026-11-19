import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConfirmModal from './ConfirmModal'

afterEach(cleanup)

describe('ConfirmModal', () => {
  it('muestra el título y mensaje por defecto', () => {
    render(<ConfirmModal open onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: '¿Confirmar acción?' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy()
  })

  it('permite personalizar título, mensaje y etiquetas', () => {
    render(
      <ConfirmModal
        open
        title="Eliminar usuario"
        message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Volver"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Eliminar usuario' })).toBeTruthy()
    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Volver' })).toBeTruthy()
  })

  it('ejecuta confirmar y cancelar', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmModal open onConfirm={onConfirm} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('deshabilita las acciones y muestra Procesando mientras carga', () => {
    render(<ConfirmModal open loading onConfirm={vi.fn()} onCancel={vi.fn()} danger />)

    const processing = screen.getByRole('button', { name: /procesando/i })
    expect(processing.disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancelar' }).disabled).toBe(true)
    expect(processing.className).toContain('bg-rose-600')
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull()
  })

  it('no renderiza si está cerrado', () => {
    render(<ConfirmModal open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
