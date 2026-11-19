import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './Toast'

function Harness() {
  const toast = useToast()
  return (
    <div>
      <button type="button" onClick={() => toast.success('Guardado')}>success</button>
      <button type="button" onClick={() => toast.error('Falló')}>error</button>
      <button type="button" onClick={() => toast.warning('Cuidado')}>warning</button>
      <button type="button" onClick={() => toast.info('Dato')}>info</button>
      <button type="button" onClick={() => toast.show('')}>vacío</button>
      <button type="button" onClick={() => toast.show('Temporal', { duration: 30 })}>temporal</button>
      <button type="button" onClick={() => toast.show('Persistente', { duration: 0 })}>persistente</button>
      <button
        type="button"
        onClick={() => Array.from({ length: 5 }, (_, i) => toast.show(`Mensaje ${i}`, { duration: 0 }))}
      >
        llenar
      </button>
      <button
        type="button"
        onClick={() => {
          toast.success('Repetido')
          toast.success('Repetido')
        }}
      >
        repetir
      </button>
    </div>
  )
}

function renderToasts() {
  return render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  )
}

function click(name) {
  fireEvent.click(screen.getByRole('button', { name }))
}

afterEach(cleanup)

describe('ToastProvider', () => {
  it('muestra las variantes con su rol y data-cy', () => {
    renderToasts()

    click('success')
    expect(screen.getByRole('status').textContent).toContain('Guardado')
    expect(screen.getByText('Guardado').closest('[data-cy="toast-success"]')).toBeTruthy()

    click('error')
    expect(screen.getByRole('alert').textContent).toContain('Falló')
    expect(screen.getByText('Falló').closest('[data-cy="toast-error"]')).toBeTruthy()

    click('warning')
    expect(screen.getByText('Cuidado').closest('[data-cy="toast-warning"]')).toBeTruthy()

    click('info')
    expect(screen.getByText('Dato').closest('[data-cy="toast-info"]')).toBeTruthy()
  })

  it('usa la variante info por defecto', () => {
    renderToasts()

    click('persistente')
    expect(screen.getByText('Persistente').closest('[data-cy="toast-info"]')).toBeTruthy()
  })

  it('ignora mensajes vacíos', () => {
    renderToasts()

    click('vacío')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('no duplica el mismo mensaje con la misma variante', () => {
    renderToasts()

    click('repetir')
    expect(screen.getAllByText('Repetido')).toHaveLength(1)
  })

  it('limita la cantidad visible a cuatro avisos', () => {
    renderToasts()

    click('llenar')
    expect(screen.queryByText('Mensaje 0')).toBeNull()
    ;['Mensaje 1', 'Mensaje 2', 'Mensaje 3', 'Mensaje 4'].forEach((message) => {
      expect(screen.getByText(message)).toBeTruthy()
    })
  })

  it('permite cerrar un aviso manualmente', () => {
    renderToasts()

    click('success')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }))
    expect(screen.queryByText('Guardado')).toBeNull()
  })

  it('cierra automáticamente los avisos con duración', async () => {
    renderToasts()

    click('temporal')
    expect(screen.getByText('Temporal')).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('Temporal')).toBeNull())
  })

  it('exige estar dentro del provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Outside() {
      useToast()
      return null
    }

    expect(() => render(<Outside />)).toThrow('useToast debe usarse dentro de ToastProvider')
    spy.mockRestore()
  })
})
