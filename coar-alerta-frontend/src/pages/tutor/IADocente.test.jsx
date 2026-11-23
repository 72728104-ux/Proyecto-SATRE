import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import { fetchClassroomInsights, fetchCourseRoster, fetchTeacherCourses, sendTeacherAssistant } from '../../api/teacher'
import IADocente from './IADocente'

vi.mock('../../api/teacher', () => ({
  fetchTeacherCourses: vi.fn(),
  fetchCourseRoster: vi.fn(),
  fetchClassroomInsights: vi.fn(),
  sendTeacherAssistant: vi.fn(),
}))

const courses = {
  data: [{ id: 5, name: 'Matemáticas AA', classroom: { id: 1, name: '5to A', grade_level: '5to' } }],
}

const roster = [{ student_id: 3, student_code: 'EST-0003', first_name: 'Valeria', last_name: 'Chávez Poma' }]

const insights = {
  available: true,
  stale: false,
  generated_at: '2026-10-11T15:00:00Z',
  data: {
    insufficient_data: false,
    courses: [
      {
        course_id: 5,
        course_name: 'Matemáticas AA',
        criteria: [{ criterion: 'D', mean: 8.2, pct_below_4: 0.6, students: 12 }],
      },
    ],
    top_gaps: [{ course_id: 5, criterion: 'D', mean: 8.2, pct_below_4: 0.6, methodologies: [] }],
    error_matrix: [],
  },
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <IADocente />
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

describe('IADocente', () => {
  beforeEach(() => {
    fetchTeacherCourses.mockResolvedValue(courses)
    fetchCourseRoster.mockResolvedValue(roster)
    fetchClassroomInsights.mockResolvedValue(insights)
    sendTeacherAssistant.mockResolvedValue({
      available: true,
      data: {
        engine: 'hybrid',
        reply: {
          text: 'Para el criterio D, usa un taller de producción con rúbrica analítica.',
          summary: 'Remedial en criterio D',
          recommended_actions: ['Taller de producción con rúbrica D'],
          suggested_materials: ['Ficha MINEDU'],
          criterion_focus: 'D',
        },
        metrics: { passing_score: 11, criteria: ['A', 'B', 'C', 'D'] },
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('envía una consulta del aula al asistente híbrido', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Asistente pedagógico')).toBeTruthy())

    fireEvent.click(
      screen.getByRole('button', {
        name: /¿Qué actividades remediales sugieres para la competencia D en este grupo\?/,
      }),
    )

    await waitFor(() =>
      expect(sendTeacherAssistant).toHaveBeenCalledWith(
        expect.objectContaining({
          classroom_id: 1,
          message: '¿Qué actividades remediales sugieres para la competencia D en este grupo?',
        }),
      ),
    )
    await waitFor(() =>
      expect(screen.getByText('Para el criterio D, usa un taller de producción con rúbrica analítica.')).toBeTruthy(),
    )
    expect(screen.getByText('Taller de producción con rúbrica D')).toBeTruthy()
  })
})
