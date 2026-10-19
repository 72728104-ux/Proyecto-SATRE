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
    await waitFor(() => expect(screen.getByText('Chávez Poma, Valeria')).toBeTruthy())
    expect(fetchStudentRisk).toHaveBeenLastCalledWith(3, expect.objectContaining({ refresh: false }))

    fireEvent.click(screen.getByRole('button', { name: /Recalcular Riesgo/i }))

    await waitFor(() =>
      expect(fetchStudentRisk).toHaveBeenLastCalledWith(3, expect.objectContaining({ refresh: true })),
    )
    expect(screen.getByText('Chávez Poma, Valeria')).toBeTruthy()
  })
})
