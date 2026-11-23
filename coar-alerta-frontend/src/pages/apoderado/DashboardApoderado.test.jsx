import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../context/AuthContext'
import { useChildSummary, useLinkedStudent } from './shared'
import DashboardApoderado from './DashboardApoderado'

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('./shared', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useChildSummary: vi.fn(),
    useLinkedStudent: vi.fn(),
  }
})

const student = { id: 8, name: 'Mateo Rojas', classroom: '4to B' }
const reload = vi.fn()
const setStudentId = vi.fn()

function renderPage() {
  return render(<DashboardApoderado />)
}

beforeEach(() => {
  useAuth.mockReturnValue({ collegeHasResidence: true })
  useLinkedStudent.mockReturnValue({ students: [student], studentId: student.id, student, setStudentId })
  useChildSummary.mockReturnValue({ summary: null, loading: false, error: null, reload })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DashboardApoderado', () => {
  it('explica cuando todavía no hay estudiantes vinculados', () => {
    useLinkedStudent.mockReturnValue({ students: [], studentId: null, student: null, setStudentId })

    renderPage()

    expect(screen.getByText('No hay estudiantes vinculados.')).toBeTruthy()
    expect(screen.getByText('Cuando la administración vincule a tu hijo/a, aquí verás su resumen académico.')).toBeTruthy()
    expect(screen.getByText('Promedio Minedu, rendimiento y asistencia en aula y residencia.')).toBeTruthy()
  })

  it('muestra la carga del resumen y el nombre del estudiante seleccionado', () => {
    useChildSummary.mockReturnValue({ summary: null, loading: true, error: null, reload })

    const { container } = renderPage()

    expect(screen.getByText('Mateo Rojas · 4to B')).toBeTruthy()
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('permite reintentar un resumen que falló', () => {
    useChildSummary.mockReturnValue({ summary: null, loading: false, error: new Error('offline'), reload })

    renderPage()

    expect(screen.getByText('No se pudo cargar la información.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('invita a seleccionar un hijo cuando no hay resumen cargado', () => {
    useLinkedStudent.mockReturnValue({
      students: [student, { id: 9, name: 'Lucía Rojas', classroom: '2do A' }],
      studentId: student.id,
      student,
      setStudentId,
    })

    renderPage()

    expect(screen.getByText('Selecciona un hijo/a para ver su resumen.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Hijo/a'), { target: { value: '9' } })
    expect(setStudentId).toHaveBeenCalledWith(9)
  })

  it('muestra métricas de aula y residencia, incluidos los estados vacíos', async () => {
    useChildSummary.mockReturnValue({
      summary: {
        student: { name: 'Mateo Rojas', classroom: '4to B' },
        academic_period: { name: '2026' },
        grades: { average: 10, literal: 'C', failing_courses: 2, by_course: [] },
        attendance: { rate: null, total: 0, by_status: { absent: 2, unknown_status: 1, present: 0 } },
        residence: { rate: 0.9, total: 0, by_status: { present: 4 } },
      },
      loading: false,
      error: null,
      reload,
    })

    renderPage()

    await waitFor(() => expect(screen.getByText('Mateo Rojas · 4to B · 2026')).toBeTruthy())
    expect(screen.getByText('10 (C)')).toBeTruthy()
    expect(screen.getByText('Escala 0–20 · 2 curso(s) por debajo de 11')).toBeTruthy()
    expect(screen.getByText('Sin registros de asistencia')).toBeTruthy()
    expect(screen.getByText('Presencia en residencia')).toBeTruthy()
    expect(screen.getByText('90%')).toBeTruthy()
    expect(screen.getByText('Sin registros de residencia')).toBeTruthy()
    expect(screen.getByText('Asistencias e inasistencias en residencia')).toBeTruthy()
    expect(screen.getByText('unknown_status')).toBeTruthy()
    expect(screen.queryByText('Sin registros en este periodo.')).toBeNull()
  })

  it('oculta las métricas residenciales si el colegio no tiene internado', async () => {
    useAuth.mockReturnValue({ collegeHasResidence: false })
    useChildSummary.mockReturnValue({
      summary: {
        student: { name: 'Mateo Rojas' },
        grades: { average: 15, literal: 'A', failing_courses: 0, by_course: [] },
        attendance: { rate: 1, total: 2, by_status: {} },
        residence: { rate: 0.5, total: 1, by_status: { absent: 1 } },
      },
      loading: false,
      error: null,
      reload,
    })

    renderPage()

    await waitFor(() => expect(screen.getByText('Resumen del hijo/a')).toBeTruthy())
    expect(screen.getByText('Mateo Rojas')).toBeTruthy()
    expect(screen.queryByText('Presencia en residencia')).toBeNull()
    expect(screen.queryByText('Asistencias e inasistencias en residencia')).toBeNull()
    expect(screen.getByText('Sin registros en este periodo.')).toBeTruthy()
  })
})
