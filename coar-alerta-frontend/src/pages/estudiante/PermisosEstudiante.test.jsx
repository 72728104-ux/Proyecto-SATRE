import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import { createPermission, fetchMyPermissions } from '../../api/student'
import PermisosEstudiante from './PermisosEstudiante'

vi.mock('../../api/student', () => ({ fetchMyPermissions: vi.fn(), createPermission: vi.fn() }))

const permission = { id: 8, type: 'salida', reason: 'Cita médica', starts_at: '2026-04-18T08:00:00Z', ends_at: '2026-04-18T18:00:00Z', status: 'pending_guardian' }
const LONG = { timeout: 12000 }

function renderPage() { return render(<ToastProvider><PermisosEstudiante /></ToastProvider>) }

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: (query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }) })
})
beforeEach(() => {
  fetchMyPermissions.mockResolvedValue({ data: [permission], meta: { current_page: 1, last_page: 1, total: 1 } })
  createPermission.mockResolvedValue({ data: { id: 9 } })
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('PermisosEstudiante', () => {
  it('lista solicitudes, filtra por estado y traduce el tipo', async () => {
    renderPage()
    expect(await screen.findByText('Cita médica', {}, LONG)).toBeTruthy()
    expect(screen.getAllByText('Salida').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Pendiente apoderado').length).toBeGreaterThanOrEqual(2)
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'approved' } })
    await waitFor(() => expect(fetchMyPermissions).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'approved' }), expect.anything()), LONG)
  })

  it('solicita un permiso y normaliza las fechas antes de enviar', async () => {
    renderPage()
    await screen.findByText('Cita médica', {}, LONG)
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    const dialog = screen.getByRole('dialog', { name: 'Solicitar permiso de salida' })
    fireEvent.change(screen.getByLabelText(/^Tipo/), { target: { value: 'médica' } })
    fireEvent.change(screen.getByLabelText(/^Motivo/), { target: { value: 'Control de salud' } })
    fireEvent.change(screen.getByLabelText(/^Salida/), { target: { value: '2026-04-18T08:00' } })
    fireEvent.change(screen.getByLabelText(/^Retorno/), { target: { value: '2026-04-18T18:00' } })
    fireEvent.click(dialog.querySelector('button[type="submit"]'))

    await waitFor(() => expect(createPermission).toHaveBeenCalledWith({
      type: 'médica', reason: 'Control de salud',
      starts_at: new Date('2026-04-18T08:00').toISOString(),
      ends_at: new Date('2026-04-18T18:00').toISOString(),
    }), LONG)
    expect(await screen.findByText('Solicitud enviada a tu apoderado.', {}, LONG)).toBeTruthy()
  })

  it('presenta errores 422 por campo y permite cerrar el formulario', async () => {
    createPermission.mockRejectedValueOnce({ status: 422, kind: 'validation', fieldErrors: { reason: 'El motivo es obligatorio.', ends_at: 'El retorno debe ser posterior.' } })
    renderPage()
    await screen.findByText('Cita médica', {}, LONG)
    fireEvent.click(screen.getByRole('button', { name: 'Nueva solicitud' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }))
    expect(await screen.findByText('El motivo es obligatorio.', {}, LONG)).toBeTruthy()
    expect(screen.getByText('El retorno debe ser posterior.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('muestra errores de carga y permite volver a intentar', async () => {
    fetchMyPermissions.mockRejectedValueOnce({ status: 500, kind: 'http', message: 'No disponible' })
    renderPage()
    expect(await screen.findByText('No se pudo cargar la información.', {}, LONG)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Cita médica', {}, LONG)).toBeTruthy()
    expect(fetchMyPermissions).toHaveBeenCalledTimes(2)
  })

  it('explica el listado vacío', async () => {
    fetchMyPermissions.mockResolvedValue({ data: [], meta: null })
    renderPage()
    expect(await screen.findByText('No tienes solicitudes de permiso.', {}, LONG)).toBeTruthy()
    expect(screen.getByText('Usa «Nueva solicitud» para pedir una salida.')).toBeTruthy()
  })
})
