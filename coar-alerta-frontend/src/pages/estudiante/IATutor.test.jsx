import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import { deleteTutorSession, fetchTutorSessions } from '../../api/student'
import IATutor from './IATutor'

vi.mock('../../api/student', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchTutorSessions: vi.fn(),
    sendTutorTurn: vi.fn(),
    deleteTutorSession: vi.fn(),
  }
})

vi.mock('./shared', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useMySummary: () => ({
      summary: { courses: [{ id: 5, name: 'Matemáticas AA' }] },
      loading: false,
      error: null,
      reload: () => {},
    }),
  }
})

const sessionRow = {
  id: 7,
  course_id: 5,
  course_name: 'Matemáticas AA',
  topic: 'Funciones lineales',
  status: 'completed',
  updated_at: '2026-04-15T10:00:00Z',
  messages: [{ id: 1, role: 'tutor', content: '¿Qué forma tiene el gráfico?' }],
}

const page = (data) => ({
  data,
  meta: { current_page: 1, last_page: 1, total: data.length, from: data.length ? 1 : 0, to: data.length, per_page: 15 },
})

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <IATutor />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('IATutor', () => {
  beforeEach(() => {
    fetchTutorSessions.mockResolvedValue(page([sessionRow]))
    deleteTutorSession.mockResolvedValue({ message: 'Sesión eliminada.', data: { id: 7 } })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('elimina una sesión propia con confirmación y actualiza la lista sin recargar', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Funciones lineales')).toBeTruthy())

    fireEvent.click(screen.getByText('Funciones lineales'))
    await waitFor(() => expect(screen.getByText('¿Qué forma tiene el gráfico?')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /eliminar sesión funciones lineales/i }))
    expect(screen.getByRole('dialog', { name: /eliminar esta sesión/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    await waitFor(() => expect(deleteTutorSession).toHaveBeenCalledWith(7))
    await waitFor(() => expect(screen.queryByText('Funciones lineales')).toBeNull())
    expect(screen.getByText('Aún no tienes sesiones.')).toBeTruthy()
    expect(screen.queryByText('¿Qué forma tiene el gráfico?')).toBeNull()
    expect(fetchTutorSessions.mock.calls.length).toBeGreaterThan(1)
  })
})
