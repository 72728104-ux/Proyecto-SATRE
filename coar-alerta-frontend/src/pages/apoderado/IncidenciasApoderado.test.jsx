import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import { fetchGuardianIncidents } from '../../api/guardian'
import { useLinkedStudent } from './shared'
import IncidenciasApoderado from './IncidenciasApoderado'

vi.mock('../../api/guardian', () => ({ fetchGuardianIncidents: vi.fn() }))
vi.mock('./shared', async (importOriginal) => ({ ...(await importOriginal()), useLinkedStudent: vi.fn() }))

const student = { id: 3, name: 'Valeria Chávez', classroom: '5to A' }
const setStudentId = vi.fn()
const incident = { id: 4, student_name: student.name, incident_at: '2026-04-15T21:30:00Z', category: 'convivencia', severity: 'leve', status: 'open' }

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: (query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }) })
})

beforeEach(() => {
  useLinkedStudent.mockReturnValue({ students: [student], studentId: 3, setStudentId })
  fetchGuardianIncidents.mockResolvedValue({ data: [incident], meta: { current_page: 1, last_page: 1, total: 1 } })
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('IncidenciasApoderado', () => {
  it('muestra la información visible y filtra por categoría/estado', async () => {
    render(<ToastProvider><IncidenciasApoderado /></ToastProvider>)
    expect(await screen.findByText('Valeria Chávez')).toBeTruthy()
    expect(screen.getAllByText('Convivencia').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Leve')).toBeTruthy()
    expect(screen.queryByText(/detalle confidencial/i)).toBeNull()
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'conducta' } })
    await waitFor(() => expect(fetchGuardianIncidents).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'conducta', student_id: 3 }), expect.anything()))
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'resolved' } })
    await waitFor(() => expect(fetchGuardianIncidents).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'resolved' }), expect.anything()))
  })

  it('muestra listado vacío y permite reintentar un error del servidor', async () => {
    fetchGuardianIncidents.mockRejectedValueOnce({ status: 500, kind: 'http', message: 'No disponible' })
    render(<ToastProvider><IncidenciasApoderado /></ToastProvider>)
    expect(await screen.findByText('No se pudo cargar la información.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByText('Valeria Chávez')).toBeTruthy())
  })

  it('explica el estado sin incidencias', async () => {
    fetchGuardianIncidents.mockResolvedValue({ data: [], meta: null })
    render(<ToastProvider><IncidenciasApoderado /></ToastProvider>)
    expect(await screen.findByText('No hay incidencias de convivencia.')).toBeTruthy()
    expect(screen.getByText('Solo se listan conducta y convivencia de tus hijos/as.')).toBeTruthy()
  })
})
