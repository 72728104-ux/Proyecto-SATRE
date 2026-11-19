import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import { useAuth } from '../../context/AuthContext'
import { fetchMyAttendances, fetchMyPresences, fetchMySummary } from '../../api/student'
import AsistenciaEstudiante from './AsistenciaEstudiante'

vi.mock('../../api/student', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchMySummary: vi.fn(),
    fetchMyAttendances: vi.fn(),
    fetchMyPresences: vi.fn(),
  }
})

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))

const page = (data, meta = null) => ({ data, meta })

const summary = {
  data: {
    student: { id: 3, name: 'Valeria Chávez' },
    courses: [
      { id: 5, name: 'Matemáticas AA' },
      { id: 6, name: 'Biología NS' },
    ],
    attendance: { rate: 0.856 },
  },
}

const attendances = [
  { id: 1, attendance_date: '2026-04-10', course_name: 'Matemáticas AA', status: 'present', notes: 'Puntual' },
  { id: 2, attendance_date: '2026-04-11', course_name: 'Biología NS', status: 'late', notes: '' },
]

const presences = [
  { id: 3, presence_date: '2026-04-11', check_type: 'night', status: 'on_permission', notes: 'Permiso' },
]

function renderPage() {
  return render(
    <ToastProvider>
      <AsistenciaEstudiante />
    </ToastProvider>,
  )
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: String(query).includes('768px'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }),
  })
})

describe('AsistenciaEstudiante', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ collegeHasResidence: true })
    fetchMySummary.mockResolvedValue(summary)
    fetchMyAttendances.mockResolvedValue(page(attendances, { current_page: 1, last_page: 2, total: 20, from: 1, to: 2 }))
    fetchMyPresences.mockResolvedValue(page(presences))
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('muestra el resumen de asistencia, las filas de aula y permite cambiar de pestaña a residencia', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Puntual')).toBeTruthy())
    expect(screen.getByText('Asistencia a clases del periodo: 85.6% (presente o tardanza).')).toBeTruthy()
    expect(screen.getAllByText('Matemáticas AA').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Presente').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Tardanza').length).toBeGreaterThan(1)
    expect(screen.getByRole('tab', { name: 'Aula' }).getAttribute('aria-selected')).toBe('true')

    fireEvent.click(screen.getByRole('tab', { name: 'Residencia' }))

    await waitFor(() => expect(screen.getByText('Nocturno')).toBeTruthy())
    expect(screen.getAllByText('Con permiso').length).toBeGreaterThan(1)
    expect(screen.getByText('Permiso')).toBeTruthy()
    expect(fetchMyPresences).toHaveBeenCalled()
    expect(screen.getByRole('tab', { name: 'Residencia' }).getAttribute('aria-selected')).toBe('true')
  })

  it('oculta Residencia si el colegio no tiene internado y usa la descripción de aula', async () => {
    useAuth.mockReturnValue({ collegeHasResidence: false })
    fetchMySummary.mockResolvedValue({ data: { courses: [], attendance: { rate: null } } })

    renderPage()

    await waitFor(() => expect(screen.getByText('Historial de asistencia en aula.')).toBeTruthy())
    expect(screen.queryByRole('tab', { name: 'Residencia' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Aula' })).toBeNull()
    expect(fetchMyPresences).not.toHaveBeenCalled()
  })

  it('filtra el aula por curso y estado enviando los parámetros al API', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Puntual')).toBeTruthy())

    fireEvent.change(screen.getByLabelText('Curso'), { target: { value: '5' } })
    await waitFor(() =>
      expect(fetchMyAttendances).toHaveBeenLastCalledWith(expect.objectContaining({ course_id: '5', status: '' }), expect.anything()),
    )

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'late' } })
    await waitFor(() =>
      expect(fetchMyAttendances).toHaveBeenLastCalledWith(expect.objectContaining({ course_id: '5', status: 'late' }), expect.anything()),
    )
  })

  it('filtra los controles de residencia por tipo y estado', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Puntual')).toBeTruthy())

    fireEvent.click(screen.getByRole('tab', { name: 'Residencia' }))
    await waitFor(() => expect(screen.getByText('Nocturno')).toBeTruthy())

    fireEvent.change(screen.getByLabelText('Control'), { target: { value: 'morning' } })
    await waitFor(() =>
      expect(fetchMyPresences).toHaveBeenLastCalledWith(expect.objectContaining({ check_type: 'morning' }), expect.anything()),
    )

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'absent' } })
    await waitFor(() =>
      expect(fetchMyPresences).toHaveBeenLastCalledWith(
        expect.objectContaining({ check_type: 'morning', status: 'absent' }),
        expect.anything(),
      ),
    )
  })

  it('reintenta la carga del aula tras un error y pagina los resultados', async () => {
    fetchMyAttendances.mockRejectedValueOnce({ status: 500, kind: 'http', message: 'Fallo' })

    renderPage()

    await waitFor(() => expect(screen.getByText('No se pudo cargar la información.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(screen.getByText('Puntual')).toBeTruthy())
    expect(fetchMyAttendances).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() =>
      expect(fetchMyAttendances).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything()),
    )
  })

  it('muestra estados vacíos tanto en aula como en residencia', async () => {
    fetchMyAttendances.mockResolvedValue(page([]))
    fetchMyPresences.mockResolvedValue(page([]))

    renderPage()

    await waitFor(() => expect(screen.getByText('No hay registros de asistencia con estos filtros.')).toBeTruthy())

    fireEvent.click(screen.getByRole('tab', { name: 'Residencia' }))
    await waitFor(() => expect(screen.getByText('No hay controles de residencia registrados.')).toBeTruthy())
    expect(screen.getByText('Si no eres interno, esta sección permanecerá vacía.')).toBeTruthy()
  })

  it('muestra el error de residencia y permite reintentar', async () => {
    fetchMyPresences.mockRejectedValueOnce({ status: 500, kind: 'http', message: 'Fallo' })

    renderPage()
    await waitFor(() => expect(screen.getByText('Puntual')).toBeTruthy())

    fireEvent.click(screen.getByRole('tab', { name: 'Residencia' }))
    await waitFor(() => expect(screen.getByText('No se pudo cargar la información.')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByText('Nocturno')).toBeTruthy())
    expect(fetchMyPresences).toHaveBeenCalledTimes(2)
  })
})
