import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import { fetchGuardianPermissions, respondPermissionAsGuardian } from '../../api/guardian'
import { useLinkedStudent } from './shared'
import AutorizarPermisos from './AutorizarPermisos'

vi.mock('../../api/guardian', () => ({ fetchGuardianPermissions: vi.fn(), respondPermissionAsGuardian: vi.fn() }))
vi.mock('./shared', async (importOriginal) => ({ ...(await importOriginal()), useLinkedStudent: vi.fn() }))

const student = { id: 3, name: 'Valeria Chávez', classroom: '5to A' }
const pending = { id: 8, student_name: student.name, type: 'salida', reason: 'Cita médica', starts_at: '2026-04-18T08:00:00Z', ends_at: '2026-04-18T18:00:00Z', status: 'pending_guardian' }
const setStudentId = vi.fn()

function renderPage() {
  return render(<ToastProvider><AutorizarPermisos /></ToastProvider>)
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: (query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }) })
})

afterEach(() => { cleanup(); vi.clearAllMocks() })
beforeEach(() => {
  useLinkedStudent.mockReturnValue({ students: [student], studentId: 3, setStudentId })
  fetchGuardianPermissions.mockResolvedValue({ data: [pending], meta: { current_page: 1, last_page: 1, total: 1 } })
  respondPermissionAsGuardian.mockResolvedValue({})
})

describe('AutorizarPermisos', () => {
  it('lista y autoriza una solicitud luego de confirmar', async () => {
    renderPage()
    expect(await screen.findByText('Cita médica')).toBeTruthy()
    expect(fetchGuardianPermissions).toHaveBeenCalledWith({ status: 'pending_guardian', student_id: 3, page: 1 }, expect.anything())
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar' }))
    expect(screen.getByRole('dialog', { name: '¿Autorizar esta salida?' })).toBeTruthy()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Autorizar' }))
    await waitFor(() => expect(respondPermissionAsGuardian).toHaveBeenCalledWith(8, 'approved'))
    expect(await screen.findByText('Permiso autorizado.')).toBeTruthy()
  })

  it('muestra errores 422 del estado y permite cancelar el diálogo', async () => {
    respondPermissionAsGuardian.mockRejectedValueOnce({ status: 422, kind: 'validation', fieldErrors: { status: 'La solicitud ya fue atendida.' } })
    renderPage()
    await screen.findByText('Cita médica')
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rechazar' }))
    expect(await screen.findByText('La solicitud ya fue atendida.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('filtra por estudiante y presenta el estado vacío', async () => {
    const other = { id: 4, name: 'Luis Quispe', classroom: '4to B' }
    useLinkedStudent.mockReturnValue({ students: [student, other], studentId: 3, setStudentId })
    fetchGuardianPermissions.mockResolvedValue({ data: [], meta: null })
    renderPage()
    await screen.findByText('No hay solicitudes de permiso.')
    fireEvent.change(screen.getByLabelText('Hijo/a'), { target: { value: '4' } })
    expect(setStudentId).toHaveBeenCalledWith(4)
    await waitFor(() => expect(fetchGuardianPermissions).toHaveBeenLastCalledWith(expect.objectContaining({ student_id: 4 }), expect.anything()))
  })
})
