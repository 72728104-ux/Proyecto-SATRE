import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import { exportClassroomReport, fetchClassroomAnalytics, fetchTeacherCourses } from '../../api/teacher'
import ReporteGrupo from './ReporteGrupo'

vi.mock('../../api/teacher', () => ({
  fetchTeacherCourses: vi.fn(),
  fetchClassroomAnalytics: vi.fn(),
  exportClassroomReport: vi.fn(),
}))

const courses = {
  data: [{ id: 5, name: 'Matemáticas AA', classroom: { id: 1, name: '5to A', grade_level: '5to' } }],
}
const report = {
  data: {
    insufficient_data: false,
    summary: { students: 25, grade_mean: 15.5, pass_rate: 0.8, attendance_rate: 0.92, open_alerts: 3 },
    risk_distribution: { ALTO: 2, MEDIO: 5, BAJO: 18 },
    courses: [{ course_id: 5, course_name: 'Matemáticas AA', grade_mean: 15.5, pass_rate: 0.8, attendance_rate: 0.92 }],
  },
}
const LONG = { timeout: 12000 }

function renderPage() {
  return render(<MemoryRouter><ToastProvider><ReporteGrupo /></ToastProvider></MemoryRouter>)
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

beforeEach(() => {
  fetchTeacherCourses.mockResolvedValue(courses)
  fetchClassroomAnalytics.mockResolvedValue(report)
  exportClassroomReport.mockResolvedValue({ blob: new Blob(), filename: 'reporte.pdf' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ReporteGrupo', () => {
  it('presenta resumen académico, distribución y resultados por curso', async () => {
    renderPage()

    expect(await screen.findByText('Reporte de grupo')).toBeTruthy()
    await waitFor(() => expect(fetchClassroomAnalytics).toHaveBeenCalledWith(1, expect.objectContaining({ signal: expect.anything() })), LONG)
    expect(screen.getByText('25')).toBeTruthy()
    expect(screen.getAllByText('15.5 (A)').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('92%').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Matemáticas AA')).toBeTruthy()
    expect(screen.getByText('80%')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('18')).toBeTruthy()
  })

  it('distingue falta de datos de una analítica disponible pero vacía', async () => {
    fetchClassroomAnalytics.mockResolvedValue({ data: { insufficient_data: true } })
    renderPage()

    expect(await screen.findByText('Aún no hay datos suficientes para este grupo.')).toBeTruthy()
    expect(screen.getByText('Registra asistencia y notas para generar el reporte.')).toBeTruthy()
  })

  it('ofrece reintentar ante un error del servidor', async () => {
    fetchClassroomAnalytics.mockRejectedValueOnce({ status: 500, kind: 'http', message: 'Error temporal' })
    renderPage()

    expect(await screen.findByText('No se pudo cargar la información.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByText('25')).toBeTruthy(), LONG)
    expect(fetchClassroomAnalytics).toHaveBeenCalledTimes(2)
  })
})
