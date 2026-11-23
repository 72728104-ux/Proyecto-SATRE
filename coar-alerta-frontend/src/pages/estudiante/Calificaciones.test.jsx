import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import { fetchMyGrades, fetchMySummary } from '../../api/student'
import Calificaciones from './Calificaciones'

vi.mock('../../api/student', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchMySummary: vi.fn(),
    fetchMyGrades: vi.fn(),
  }
})

const summary = {
  data: {
    student: { id: 3, name: 'Valeria Chávez' },
    courses: [
      { id: 5, name: 'Matemáticas AA' },
      { id: 6, name: 'Biología NS' },
    ],
    grades: {
      average: 15.5,
      literal: 'A',
      scale: 20,
      failing_courses: 1,
      by_course: [
        {
          course_id: 5,
          course_name: 'Matemáticas AA',
          average: 16.5,
          literal: 'A',
          count: 2,
          criteria: { A: 16, B: 13, C: null, D: 9 },
        },
        {
          course_id: 6,
          course_name: 'Biología NS',
          average: 12,
          literal: 'B',
          count: 1,
          criteria: { A: 11, B: null, C: 10, D: 14 },
        },
      ],
    },
  },
}

const grades = {
  data: [
    {
      id: 1,
      evaluation_name: 'Prueba 1',
      course_name: 'Matemáticas AA',
      criterion: 'A',
      evaluation_date: '2026-04-10',
      score: 14.5,
      literal: 'B',
    },
    {
      id: 2,
      evaluation_name: 'Ensayo de laboratorio',
      course_name: 'Biología NS',
      criterion: null,
      evaluation_date: '2026-04-12',
      score: null,
      literal: null,
    },
  ],
  meta: { current_page: 1, last_page: 2, total: 20, from: 1, to: 2 },
}

function renderPage() {
  return render(
    <ToastProvider>
      <Calificaciones />
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

describe('Calificaciones', () => {
  beforeEach(() => {
    fetchMySummary.mockResolvedValue(summary)
    fetchMyGrades.mockResolvedValue(grades)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('muestra promedio general, desglose por criterio y notas con literal Minedu', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('Prueba 1')).toBeTruthy())
    expect(
      screen.getByText('Promedio general 15.5 (A) · escala 0–20, aprobatorio ≥ 11'),
    ).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Matemáticas AA' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Biología NS' })).toBeTruthy()
    expect(screen.getByText('16 (A)')).toBeTruthy()
    expect(screen.getByText('13 (B)')).toBeTruthy()
    expect(screen.getByText('12 (B)')).toBeTruthy()
    expect(screen.getByText('9 (C)')).toBeTruthy()
    expect(screen.getByText('14.5 (B)')).toBeTruthy()
    expect(screen.getAllByText('Criterio A').length).toBeGreaterThan(1)
    expect(screen.getByText('Ensayo de laboratorio')).toBeTruthy()
    expect(fetchMyGrades).toHaveBeenCalledWith(
      expect.objectContaining({ course_id: '', criterion: '', page: 1 }),
      expect.anything(),
    )
  })

  it('filtra las tarjetas por curso y envía curso y criterio al listado', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Prueba 1')).toBeTruthy())

    fireEvent.change(screen.getByLabelText('Curso'), { target: { value: '5' } })
    expect(screen.queryByRole('heading', { name: 'Biología NS' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Matemáticas AA' })).toBeTruthy()

    await waitFor(() =>
      expect(fetchMyGrades).toHaveBeenLastCalledWith(
        expect.objectContaining({ course_id: '5', criterion: '' }),
        expect.anything(),
      ),
    )

    fireEvent.change(screen.getByLabelText('Criterio'), { target: { value: 'A' } })
    await waitFor(() =>
      expect(fetchMyGrades).toHaveBeenLastCalledWith(
        expect.objectContaining({ course_id: '5', criterion: 'A' }),
        expect.anything(),
      ),
    )
  })

  it('pagina los resultados de la tabla', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Prueba 1')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() =>
      expect(fetchMyGrades).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
        expect.anything(),
      ),
    )
  })

  it('reintenta el listado tras un error de red', async () => {
    fetchMyGrades.mockRejectedValueOnce({ status: 500, kind: 'http', message: 'Fallo' })

    renderPage()

    await waitFor(() => expect(screen.getByText('No se pudo cargar la información.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(screen.getByText('Prueba 1')).toBeTruthy())
    expect(fetchMyGrades).toHaveBeenCalledTimes(2)
  })

  it('explica el periodo vacío cuando no hay notas ni cursos evaluados', async () => {
    fetchMySummary.mockResolvedValue({
      data: { courses: [], grades: { by_course: [] } },
    })
    fetchMyGrades.mockResolvedValue({ data: [], meta: null })

    renderPage()

    await waitFor(() => expect(screen.getByText('Aún no hay notas en este periodo.')).toBeTruthy())
    expect(
      screen.getByText('Cuando tu docente registre evaluaciones, verás el desglose por criterio A–D.'),
    ).toBeTruthy()
    expect(
      screen.getByText('Notas Minedu por curso (escala 0–20, AD/A/B/C, aprobatorio ≥ 11) y criterios A–D.'),
    ).toBeTruthy()
    await waitFor(() => expect(screen.getByText('No hay calificaciones con estos filtros.')).toBeTruthy())
  })

  it('muestra esqueletos mientras llega el resumen', async () => {
    fetchMySummary.mockReturnValue(new Promise(() => {}))
    fetchMyGrades.mockResolvedValue({ data: [], meta: null })

    const { container } = renderPage()

    await waitFor(() => expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(3))
    expect(
      screen.getByText('Notas Minedu por curso (escala 0–20, AD/A/B/C, aprobatorio ≥ 11) y criterios A–D.'),
    ).toBeTruthy()
  })
})
