import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Modal from './Modal'

afterEach(cleanup)

describe('Modal', () => {
  it('no renderiza nada si está cerrado', () => {
    const { container } = render(<Modal open={false} title="Oculto">Contenido</Modal>)

    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renderiza el diálogo accesible con título y contenido', () => {
    render(<Modal open title="Editar aula">Contenido interno</Modal>)

    const dialog = screen.getByRole('dialog', { name: 'Editar aula' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Editar aula' })).toBeTruthy()
    expect(screen.getByText('Contenido interno')).toBeTruthy()
  })

  it('cierra con el botón y con Escape', () => {
    const onClose = vi.fn()
    render(<Modal open title="Cerrar" onClose={onClose}>Contenido</Modal>)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('no muestra botón de cierre ni escucha Escape sin onClose', () => {
    render(<Modal open title="Sin cierre">Contenido</Modal>)

    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull()
    expect(() => fireEvent.keyDown(window, { key: 'Escape' })).not.toThrow()
  })

  it('deja de escuchar Escape al desmontarse', () => {
    const onClose = vi.fn()
    const { unmount } = render(<Modal open title="Efímero" onClose={onClose}>Contenido</Modal>)

    unmount()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
