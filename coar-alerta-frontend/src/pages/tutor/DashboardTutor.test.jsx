import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import DashboardTutor from './DashboardTutor'
import { exportClassroomReport, fetchCourseRoster, fetchStudentRisk, fetchTeacherCourses } from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
  fetchTeacherCourses: vi.fn(),
  fetchCourseRoster: vi.fn(),
  fetchStudentRisk: vi.fn(),
  exportClassroomReport: vi.fn(),
}))

const courses = {
  data: [{ id: 5, name: 'Matemáticas AA', classroom: { id: 1, name: '5to A', grade_level: '5to' } }],
}

const roster = [
  { student_id: 3, student_code: 'EST-0003', first_name: 'Valeria', last_name: 'Chávez Poma' },
]

const risk = {
  available: true,
  data: {
    student_id: 3,
    risk_level: 'BAJO',
    risk_score: 12,
    data_coverage: 0.25,
    insufficient_data: false,
    needs_human_review: false,
    recommendation: 'Seguimiento regular.',
    factors: [],
  },
}

const LONG = { timeout: 12000 }

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <DashboardTutor />
      </ToastProvider>
    </MemoryRouter>,
  )
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

describe('DashboardTutor', () => {
  beforeEach(() => {
    fetchTeacherCourses.mockResolvedValue(courses)
    fetchCourseRoster.mockResolvedValue(roster)
    fetchStudentRisk.mockResolvedValue(risk)
    exportClassroomReport.mockResolvedValue({ blob: new Blob(), filename: 'reporte.pdf' })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('fuerza el recálculo de riesgo sin recargar la página', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Chávez Poma, Valeria')).toBeTruthy(), LONG)
    expect(fetchStudentRisk).toHaveBeenLastCalledWith(3, expect.objectContaining({ refresh: false }))

    fireEvent.click(screen.getByRole('button', { name: /Recalcular Riesgo/i }))

    await waitFor(() =>
      expect(fetchStudentRisk).toHaveBeenLastCalledWith(3, expect.objectContaining({ refresh: true })),
    )
    expect(screen.getByText('Chávez Poma, Valeria')).toBeTruthy()
  })

  it('muestra el estado vacío cuando el docente no tiene aulas asignadas', async () => {
    fetchTeacherCourses.mockResolvedValue({ data: [] })

    renderPage()

    await waitFor(() => expect(screen.getByText('No tienes aulas asignadas.')).toBeTruthy(), LONG)
    expect(screen.getByText('Pide a administración que te asigne cursos del periodo vigente.')).toBeTruthy()
  })

  it('permite reintentar si falla la carga de cursos del docente', async () => {
    fetchTeacherCourses.mockRejectedValueOnce({ status: 500, kind: 'http', message: 'Falla temporal' })

    renderPage()

    await waitFor(() => expect(screen.getByText('No se pudo cargar la información.')).toBeTruthy(), LONG)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(screen.getByText('Chávez Poma, Valeria')).toBeTruthy(), LONG)
    expect(fetchTeacherCourses).toHaveBeenCalledTimes(2)
  })

  it('muestra los detalles de revisión humana y filtra estudiantes por riesgo', async () => {
    fetchCourseRoster.mockResolvedValue([
      roster[0],
      { student_id: 4, student_code: 'EST-0004', first_name: 'Luis', last_name: 'Quispe' },
    ])
    fetchStudentRisk.mockImplementation((studentId) =>
      Promise.resolve({
        available: true,
        data:
          studentId === 3
            ? {
                ...risk.data,
                risk_level: 'ALTO',
                needs_human_review: true,
                factors: [
                  { key: 'attendance', label: 'Inasistencias', contribution: 2.4 },
                  { key: 'grades', label: 'Notas', contribution: 1.2 },
                ],
              }
            : { ...risk.data, risk_level: 'BAJO' },
      }),
    )

    renderPage()

    await waitFor(() => expect(screen.getByText('Quispe, Luis')).toBeTruthy(), LONG)
    expect(screen.getByText('Requiere revisión humana prioritaria.')).toBeTruthy()
    expect(screen.getByText('Inasistencias')).toBeTruthy()
    expect(screen.getByText('+2.4 pts')).toBeTruthy()
    expect(screen.queryByText('2 sin datos suficientes')).toBeNull()

    fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: 'MEDIO' } })
    expect(screen.getByText('Ningún estudiante coincide con el filtro.')).toBeTruthy()
  })

  it('explica el fallo del motor analítico y el filtro sin datos', async () => {
    fetchStudentRisk.mockResolvedValue({ available: false, data: null })

    renderPage()

    await waitFor(() => expect(screen.getByText('Chávez Poma, Valeria')).toBeTruthy(), LONG)
    expect(screen.getByText(/El motor analítico no devolvió predicciones/)).toBeTruthy()
    expect(screen.getByText('Sin evaluación de riesgo todavía.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: 'none' } })
    expect(screen.getByText('Chávez Poma, Valeria')).toBeTruthy()
  })
})
