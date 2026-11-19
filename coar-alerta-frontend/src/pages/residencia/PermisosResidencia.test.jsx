import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import { fetchPermissions, resolvePermission } from '../../api/residence'
import PermisosResidencia from './PermisosResidencia'

vi.mock('../../api/residence', () => ({ fetchPermissions: vi.fn(), resolvePermission: vi.fn() }))
const permissions = [
  { id: 8, student_name: 'Valeria Chávez', type: 'salida', reason: 'Cita médica', starts_at: '2026-04-18T08:00:00Z', ends_at: '2026-04-18T18:00:00Z', status: 'approved_guardian' },
  { id: 9, student_name: 'Luis Quispe', type: 'salida', reason: 'Solicitud pendiente', starts_at: '2026-04-19T08:00:00Z', ends_at: '2026-04-19T18:00:00Z', status: 'pending_guardian' },
  { id: 10, student_name: 'Ana Rojas', type: 'salida', reason: 'Resuelto', starts_at: '2026-04-20T08:00:00Z', ends_at: '2026-04-20T18:00:00Z', status: 'rejected', reviewed_at: '2026-04-20T20:00:00Z' },
]
function renderPage() { return render(<ToastProvider><PermisosResidencia /></ToastProvider>) }
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: (query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }) })
})
beforeEach(() => {
  fetchPermissions.mockResolvedValue({ data: permissions, meta: { current_page: 1, last_page: 1, total: permissions.length } })
  resolvePermission.mockResolvedValue({})
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('PermisosResidencia', () => {
  it('muestra acciones según estado y aprueba el permiso autorizado por tutor', async () => {
    renderPage()
    expect(await screen.findByText('Cita médica')).toBeTruthy()
    expect(screen.getByText('Solicitud pendiente')).toBeTruthy()
    expect(screen.getByText('Resuelto')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Aprobar' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Rechazar' })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aprobar' }))
    await waitFor(() => expect(resolvePermission).toHaveBeenCalledWith(8, 'approved'))
    expect(await screen.findByText('Permiso aprobado.')).toBeTruthy()
  })

  it('rechaza una solicitud pendiente y aplica el filtro de estado', async () => {
    fetchPermissions.mockImplementation(({ status }) => Promise.resolve({
      data: status === 'pending_guardian' ? [permissions[1]] : permissions,
      meta: { current_page: 1, last_page: 1, total: status === 'pending_guardian' ? 1 : permissions.length },
    }))
    renderPage()
    await screen.findByText('Cita médica')
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'pending_guardian' } })
    await waitFor(() => expect(fetchPermissions).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'pending_guardian' }), expect.anything()))
    fireEvent.click(screen.getAllByRole('button', { name: 'Rechazar' })[0])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rechazar' }))
    await waitFor(() => expect(resolvePermission).toHaveBeenCalledWith(9, 'rejected'))
    expect(await screen.findByText('Permiso rechazado.')).toBeTruthy()
  })

  it('presenta el estado vacío y reintenta los errores de carga', async () => {
    fetchPermissions.mockRejectedValueOnce({ status: 500, kind: 'http', message: 'Temporal' })
    renderPage()
    expect(await screen.findByText('No se pudo cargar la información.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByText('Cita médica')).toBeTruthy())
  })
})
