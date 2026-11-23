import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import NotasIB from './NotasIB'
import { fetchCourseRoster, fetchGrades, fetchTeacherCourses, saveGrade } from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
  fetchTeacherCourses: vi.fn(),
  fetchGrades: vi.fn(),
  fetchCourseRoster: vi.fn(),
  saveGrade: vi.fn(),
}))

const courses = {
  data: [{ id: 5, name: 'Matemáticas AA', classroom: { id: 1, name: '5to A' } }],
}

const grades = {
  data: [
    {
      id: 1,
      student_name: 'Valeria Chávez Poma',
      course_name: 'Matemáticas AA',
      evaluation_name: 'Prueba 1',
      criterion: 'A',
      evaluation_date: '2026-04-10',
      score: 16.5,
      literal: 'A',
      max_score: 20,
    },
  ],
  meta: { current_page: 1, last_page: 1, total: 1, from: 1, to: 1, per_page: 15 },
}

function renderPage() {
  return render(
    <ToastProvider>
      <NotasIB />
    </ToastProvider>,
  )
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: String(query).includes('min-width'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }),
  })
})

describe('NotasIB', () => {
  beforeEach(() => {
    fetchTeacherCourses.mockResolvedValue(courses)
    fetchGrades.mockResolvedValue(grades)
    fetchCourseRoster.mockResolvedValue([])
    saveGrade.mockResolvedValue({ data: grades.data[0] })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('explica los criterios A–D con leyenda, filtro descriptivo y tooltips', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('16.5 (A)')).toBeTruthy())

    expect(
      screen.getByText(
        'La evaluación desglosada por Criterio (A-D) permite a la IA detectar la competencia exacta que el estudiante necesita reforzar.',
      ),
    ).toBeTruthy()

    const filter = screen.getByLabelText('Criterio')
    expect([...filter.options].map((option) => option.textContent)).toEqual([
      'Todos',
      'Criterio A - Conocimiento y Comprensión',
      'Criterio B - Investigación',
      'Criterio C - Comunicación',
      'Criterio D - Aplicación Real',
    ])

    const letter = screen.getByRole('button', { name: /Criterio A: Conocimiento y comprensión conceptual/ })
    fireEvent.mouseEnter(letter)
    expect(screen.getByRole('tooltip').textContent).toBe(
      'Matemáticas AA · Criterio A: Conocimiento y comprensión conceptual.',
    )
    fireEvent.mouseLeave(letter)

    fireEvent.change(screen.getByLabelText('Curso'), { target: { value: '5' } })
    fireEvent.mouseEnter(screen.getByLabelText('Qué significan los criterios A–D'))
    expect(screen.getByRole('tooltip').textContent).toContain('Criterios A–D · Matemáticas AA')
    fireEvent.mouseLeave(screen.getByLabelText('Qué significan los criterios A–D'))

    fireEvent.click(screen.getByRole('button', { name: /Registrar nota/i }))
    const formHelp = within(screen.getByRole('dialog')).getByLabelText('Qué significan los criterios A–D')
    fireEvent.mouseEnter(formHelp)
    expect(screen.getByRole('tooltip').textContent).toContain('C — Comunicación y expresión matemática/académica.')
  })

  it('lista la nota vigesimal con letra Minedu y previsualiza AD/A/B/C al escribir', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('16.5 (A)')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /Registrar nota/i }))
    const score = screen.getByLabelText(/Nota \(0–20\)/)
    fireEvent.change(score, { target: { value: '16.5' } })
    expect(screen.getByTestId('minedu-literal-preview').textContent).toBe('A')

    fireEvent.change(score, { target: { value: '19' } })
    expect(screen.getByTestId('minedu-literal-preview').textContent).toBe('AD')

    fireEvent.change(score, { target: { value: '21' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByText('La nota debe ser un número entre 0.00 y 20.00.')).toBeTruthy()
    expect(saveGrade).not.toHaveBeenCalled()
  })
})
