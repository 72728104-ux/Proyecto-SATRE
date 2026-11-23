import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import { fetchPeriods, savePeriod, setCurrentPeriod } from '../../api/admin'
import Periodos from './Periodos'

vi.mock('../../api/admin', () => ({
  fetchPeriods: vi.fn(),
  savePeriod: vi.fn(),
  setCurrentPeriod: vi.fn(),
}))

const periods = [
  { id: 2, name: '2026', start_date: '2026-03-01', end_date: '2026-12-20', is_current: true },
  { id: 3, name: '2027', start_date: '2027-03-01', end_date: '2027-12-20', is_current: false },
]

function renderPage() {
  return render(<ToastProvider><Periodos /></ToastProvider>)
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }),
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  fetchPeriods.mockResolvedValue({ data: periods, meta: { current_page: 1, last_page: 1, total: 2 } })
  savePeriod.mockResolvedValue({ data: { id: 4 } })
  setCurrentPeriod.mockResolvedValue({ message: 'Periodo actualizado.' })
})

describe('Periodos', () => {
  it('lista periodos y confirma el cambio de periodo vigente', async () => {
    renderPage()

    expect(await screen.findByText('2026')).toBeTruthy()
    expect(screen.getByText('Vigente')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar vigente' })[0])
    expect(screen.getByRole('dialog', { name: 'Cambiar periodo vigente' })).toBeTruthy()
    expect(screen.getByText('2027 pasará a ser el periodo vigente y el actual dejará de serlo.')).toBeTruthy()
    fireEvent.click(withinDialogButton(screen.getByRole('dialog'), 'Marcar vigente'))

    await waitFor(() => expect(setCurrentPeriod).toHaveBeenCalledWith(3))
    expect(await screen.findByText('Periodo actualizado.')).toBeTruthy()
    await waitFor(() => expect(fetchPeriods).toHaveBeenCalledTimes(2))
  })

  it('crea periodo con datos requeridos y muestra errores 422 del backend', async () => {
    savePeriod.mockRejectedValueOnce({
      status: 422,
      kind: 'validation',
      fieldErrors: { name: 'El nombre ya existe.', end_date: 'La fecha final debe ser posterior.' },
    })

    renderPage()
    await screen.findByText('2026')
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo periodo' }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo periodo' })
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: '2026' } })
    fireEvent.change(screen.getByLabelText(/^Inicio/), { target: { value: '2026-03-01' } })
    fireEvent.change(screen.getByLabelText(/^Fin/), { target: { value: '2026-02-01' } })
    fireEvent.click(withinDialogButton(dialog, 'Guardar'))

    expect(await screen.findByText('El nombre ya existe.')).toBeTruthy()
    expect(screen.getByText('La fecha final debe ser posterior.')).toBeTruthy()
    expect(savePeriod).toHaveBeenCalledWith(undefined, {
      name: '2026', start_date: '2026-03-01', end_date: '2026-02-01',
    })
  })

  it('edita un periodo existente y permite cancelar el formulario', async () => {
    renderPage()
    await screen.findByText('2026')
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])

    const dialog = screen.getByRole('dialog', { name: 'Editar periodo' })
    expect(screen.getByLabelText(/^Nombre/).value).toBe('2026')
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: '2026-I' } })
    fireEvent.click(withinDialogButton(dialog, 'Guardar'))

    await waitFor(() => expect(savePeriod).toHaveBeenCalledWith(2, {
      name: '2026-I', start_date: '2026-03-01', end_date: '2026-12-20',
    }))
    await screen.findByText('Cambios guardados.')

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(2))
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('muestra la vista vacía cuando no hay periodos', async () => {
    fetchPeriods.mockResolvedValue({ data: [], meta: null })
    renderPage()
    expect(await screen.findByText('No hay periodos registrados.')).toBeTruthy()
  })
})

function withinDialogButton(dialog, name) {
  return [...dialog.querySelectorAll('button')].find((button) => button.textContent.trim() === name)
}
