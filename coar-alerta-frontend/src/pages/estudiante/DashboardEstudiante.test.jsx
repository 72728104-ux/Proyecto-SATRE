import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import { fetchMyAlerts, fetchMyRisk, fetchMySummary } from '../../api/student'
import DashboardEstudiante from './DashboardEstudiante'

vi.mock('../../api/student', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchMySummary: vi.fn(),
    fetchMyRisk: vi.fn(),
    fetchMyAlerts: vi.fn(),
  }
})

const summary = {
  data: {
    student: { id: 3, name: 'Valeria Chávez', classroom: '5to A' },
    academic_period: { name: '2026' },
    grades: {
      average: 15.5,
      literal: 'A',
      failing_courses: 1,
      by_course: [
        { course_id: 5, course_name: 'Matemáticas AA', average: 16.5, literal: 'A', count: 2 },
        { course_id: 6, course_name: 'Biología NS', average: 12, literal: 'B', count: 1 },
      ],
    },
    attendance: {
      rate: 0.856,
      total: 10,
      by_status: { present: 6, late: 2, absent: 1, other: 0 },
    },
    alerts: { open: 2 },
  },
}

const risk = {
  available: true,
  data: { student_id: 3, risk_level: 'ALTO', recommendation: 'Reforzar hábitos de estudio.' },
}

const alertsPage = {
  data: [
    { id: 1, message: 'Faltas reiteradas', severity: 'ALTO', status: 'open', created_at: '2026-04-10T10:00:00Z' },
    { id: 2, title: 'Bajo rendimiento', severity: 'MEDIO', status: 'resolved', created_at: '2026-04-11T10:00:00Z' },
  ],
  meta: { current_page: 1, last_page: 2, total: 20, from: 1, to: 10 },
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <DashboardEstudiante />
      </ToastProvider>
    </MemoryRouter>,
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

describe('DashboardEstudiante', () => {
  beforeEach(() => {
    fetchMySummary.mockResolvedValue(summary)
    fetchMyRisk.mockResolvedValue(risk)
    fetchMyAlerts.mockResolvedValue(alertsPage)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('muestra el esqueleto de carga del resumen', async () => {
    fetchMySummary.mockReturnValue(new Promise(() => {}))

    const { container } = renderPage()

    await waitFor(() => expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(3))
    expect(screen.getByText('Promedios, asistencia e historial de alertas del periodo vigente.')).toBeTruthy()
  })

  it('recupera el resumen al reintentar después de un error', async () => {
    fetchMySummary.mockRejectedValueOnce({ status: 500, kind: 'http', message: 'Fallo' })

    renderPage()

    await waitFor(() => expect(screen.getByText('No se pudo cargar la información.')).toBeTruthy())
    expect(screen.getByText('Promedios, asistencia e historial de alertas del periodo vigente.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(screen.getByText('Valeria Chávez · 5to A · 2026')).toBeTruthy())
    expect(fetchMySummary).toHaveBeenCalledTimes(2)
  })

  it('resume promedios, asistencia, riesgo y alertas del periodo', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Faltas reiteradas')).toBeTruthy())
    await waitFor(() => expect(screen.getByText('Reforzar hábitos de estudio.')).toBeTruthy())

    expect(screen.getByText('Valeria Chávez · 5to A · 2026')).toBeTruthy()

    const averageCard = screen.getByText('Promedio general').closest('article')
    expect(within(averageCard).getByText('15.5 (A)')).toBeTruthy()
    expect(within(averageCard).getByText('Escala 0–20 · 1 curso(s) por debajo de 11')).toBeTruthy()

    const attendanceCard = screen.getByText('Asistencia').closest('article')
    expect(within(attendanceCard).getByText('85.6%')).toBeTruthy()
    expect(within(attendanceCard).getByText('10 registros de clase')).toBeTruthy()

    const alertsCard = screen.getByText('Alertas activas').closest('article')
    expect(within(alertsCard).getByText('2')).toBeTruthy()
    expect(within(alertsCard).getByText('Tu tutor ya está al tanto')).toBeTruthy()

    expect(screen.getByText('Reforzar hábitos de estudio.')).toBeTruthy()
    expect(screen.getAllByText('Alto').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Medio')).toBeTruthy()

    expect(screen.getByText('Bajo rendimiento')).toBeTruthy()
    expect(screen.getByText('Abierta')).toBeTruthy()
    expect(screen.getByText('Resuelta')).toBeTruthy()

    expect(screen.getByText('Matemáticas AA')).toBeTruthy()
    expect(screen.getByText('16.5 (A)')).toBeTruthy()
    expect(screen.getByText('2 evaluación(es)')).toBeTruthy()

    expect(screen.getByText('Asistencia por estado')).toBeTruthy()
    expect(screen.getByText('Presente')).toBeTruthy()
    expect(screen.getByText('Tardanza')).toBeTruthy()
    expect(screen.getByText('Falta injustificada')).toBeTruthy()
    expect(screen.getByText('6')).toBeTruthy()
    expect(screen.queryByText('other')).toBeNull()
  })

  it('explica la ausencia de notas, riesgo y alertas sin inventar datos', async () => {
    fetchMySummary.mockResolvedValue({
      data: {
        student: { id: 3, name: 'Valeria Chávez' },
        academic_period: { name: '2026' },
        grades: { average: null, failing_courses: 0, by_course: [] },
        attendance: { rate: null, total: 0, by_status: {} },
        alerts: { open: 0 },
      },
    })
    fetchMyRisk.mockResolvedValue({ available: false, data: null })
    fetchMyAlerts.mockResolvedValue({ data: [], meta: null })

    renderPage()

    await waitFor(() => expect(screen.getByText('No tienes alertas registradas.')).toBeTruthy())

    expect(screen.getByText('Aún no tienes notas registradas')).toBeTruthy()
    expect(screen.getByText('Sin registros de asistencia')).toBeTruthy()
    expect(screen.getByText('Sin alertas abiertas')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Tu evaluación de riesgo aún no está disponible.')).toBeTruthy())
    expect(screen.getByText('Aún no hay notas en este periodo.')).toBeTruthy()
    expect(screen.queryByText('Asistencia por estado')).toBeNull()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('reintenta el historial de alertas de forma independiente', async () => {
    fetchMyAlerts.mockRejectedValueOnce({ status: 500, kind: 'http', message: 'Fallo' })

    renderPage()

    await waitFor(() => expect(screen.getByText('No se pudo cargar la información.')).toBeTruthy())
    expect(screen.getByText('Valeria Chávez · 5to A · 2026')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByText('Faltas reiteradas')).toBeTruthy())
    expect(fetchMyAlerts).toHaveBeenCalledTimes(2)
  })

  it('pagina el historial de alertas', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Faltas reiteradas')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() =>
      expect(fetchMyAlerts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything()),
    )
  })

  it('mantiene el esqueleto del riesgo mientras la predicción está en camino', async () => {
    fetchMyRisk.mockReturnValue(new Promise(() => {}))

    const { container } = renderPage()

    await waitFor(() => expect(screen.getByText('Valeria Chávez · 5to A · 2026')).toBeTruthy())
    await waitFor(() => expect(fetchMyRisk).toHaveBeenCalled())
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText('Sin recomendación registrada.')).toBeNull()
  })
})
