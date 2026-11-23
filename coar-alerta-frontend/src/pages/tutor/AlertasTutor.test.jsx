import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import AlertasTutor from './AlertasTutor'
import { fetchAlerts, fetchTeacherCourses } from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
  fetchAlerts: vi.fn(),
  fetchTeacherCourses: vi.fn(),
  updateAlert: vi.fn(),
  createIntervention: vi.fn(),
  createFollowUp: vi.fn(),
}))

const courses = {
  data: [
    { id: 5, name: 'Matemáticas AA', classroom: { id: 1, name: '5to A', grade_level: '5to' } },
    { id: 6, name: 'Física', classroom: { id: 2, name: '5to B', grade_level: '5to' } },
    { id: 7, name: 'Química', classroom: { id: 1, name: '5to A', grade_level: '5to' } },
  ],
}

const alerts = {
  data: [
    {
      id: 1,
      student: { id: 3, name: 'Valeria Chávez' },
      severity: 'ALTO',
      title: 'Riesgo académico',
      message: 'Bajó sus notas.',
      status: 'open',
      created_at: '2026-10-20',
      interventions: [],
    },
  ],
  meta: { current_page: 1, last_page: 1, total: 1 },
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <AlertasTutor />
      </ToastProvider>
    </MemoryRouter>,
  )
}

const LONG = { timeout: 12000 }

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

describe('AlertasTutor', () => {
  beforeEach(() => {
    fetchTeacherCourses.mockResolvedValue(courses)
    fetchAlerts.mockResolvedValue(alerts)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('carga el aula del docente y pide las alertas abiertas de todas sus aulas', async () => {
    renderPage()

    expect(screen.getByText('Alertas e intervenciones')).toBeTruthy()
    expect(document.querySelector('[data-cy="alertas-tutor"]')).toBeTruthy()

    await waitFor(
      () => expect(fetchAlerts).toHaveBeenCalledWith({ classroom_id: null, status: 'open', page: 1 }, expect.anything()),
      LONG,
    )
    await waitFor(() => expect(screen.getByRole('option', { name: '5to A · 5to' })).toBeTruthy(), LONG)
    expect(screen.getByRole('option', { name: 'Todas mis aulas' })).toBeTruthy()
    expect(screen.getByRole('option', { name: '5to B · 5to' })).toBeTruthy()
    expect(screen.getByLabelText('Estado').value).toBe('open')

    await waitFor(() => expect(screen.getByText('Riesgo académico')).toBeTruthy(), LONG)
    expect(screen.getByText('Valeria Chávez · 20/10/2026')).toBeTruthy()
  })

  it('filtra por aula y por estado usando el espacio de trabajo compartido', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('option', { name: '5to B · 5to' })).toBeTruthy(), LONG)
    await waitFor(() => expect(fetchAlerts).toHaveBeenCalled(), LONG)

    fireEvent.change(screen.getByLabelText('Aula'), { target: { value: '2' } })
    await waitFor(
      () => expect(fetchAlerts).toHaveBeenLastCalledWith({ classroom_id: 2, status: 'open', page: 1 }, expect.anything()),
      LONG,
    )

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: '' } })
    await waitFor(
      () => expect(fetchAlerts).toHaveBeenLastCalledWith({ classroom_id: 2, status: '', page: 1 }, expect.anything()),
      LONG,
    )
  })

  it('ofrece los tipos de intervención de tutoría en el modal', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Riesgo académico')).toBeTruthy(), LONG)

    fireEvent.click(screen.getByRole('button', { name: /Intervención/ }))
    const dialog = screen.getByRole('dialog')
    const options = [...dialog.querySelectorAll('select option')].map((option) => option.textContent)
    expect(options).toEqual([
      'Selecciona…',
      'Tutoría individual',
      'Reunión con apoderado',
      'Plan de recuperación académica',
      'Derivación a psicología',
      'Otro',
    ])
  })

  it('muestra el vacío con la descripción del tutor', async () => {
    fetchAlerts.mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } })
    renderPage()

    await waitFor(() => expect(screen.getByText('No hay alertas con estos filtros.')).toBeTruthy(), LONG)
    expect(screen.getByText('Las alertas se generan cada noche a partir del riesgo del aula.')).toBeTruthy()
  })

  it('muestra el error de carga y reintenta la petición', async () => {
    fetchAlerts
      .mockRejectedValueOnce({ status: 500, message: 'Falla temporal' })
      .mockResolvedValue(alerts)
    renderPage()

    await waitFor(() => expect(screen.getByText('No se pudo cargar la información.')).toBeTruthy(), LONG)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByText('Riesgo académico')).toBeTruthy(), LONG)
  })
})
