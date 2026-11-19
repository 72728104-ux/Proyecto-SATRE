import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import Aulas from './Aulas'
import { fetchClassrooms, fetchPeriods, fetchUsers, saveClassroom } from '../../api/admin'

vi.mock('../../api/admin', () => ({
  fetchAuditLogs: vi.fn(),
  fetchUsers: vi.fn(),
  fetchPeriods: vi.fn(),
  fetchClassrooms: vi.fn(),
  fetchCourses: vi.fn(),
  fetchAdminMetrics: vi.fn(),
  saveUser: vi.fn(),
  saveClassroom: vi.fn(),
  saveCourse: vi.fn(),
  savePeriod: vi.fn(),
  toggleUserActive: vi.fn(),
  resetUserPassword: vi.fn(),
  setCurrentPeriod: vi.fn(),
}))

const page = (rows) => ({
  data: rows,
  meta: {
    current_page: 1,
    last_page: 1,
    total: rows.length,
    from: rows.length ? 1 : 0,
    to: rows.length,
    per_page: 15,
  },
})

const classroom = {
  id: 4,
  name: '5to A',
  grade_level: '5to',
  capacity: 30,
  academic_period: { id: 2, name: '2026' },
  tutor: { id: 3, name: 'Ana Docente' },
}

const renderPage = () =>
  render(
    <ToastProvider>
      <Aulas />
    </ToastProvider>,
  )

const listCall = (matcher) =>
  fetchClassrooms.mock.calls.some(([params]) => Object.entries(matcher).every(([key, value]) => params?.[key] === value))

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }),
  })
})

beforeEach(() => {
  fetchClassrooms.mockResolvedValue(page([classroom]))
  fetchPeriods.mockResolvedValue({ data: [{ id: 2, name: '2026', is_current: true }] })
  fetchUsers.mockResolvedValue({
    data: [{ id: 3, profile_id: 3, name: 'Ana Docente', email: 'ana@coar.edu.pe' }],
  })
  saveClassroom.mockResolvedValue({ data: classroom })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Aulas', () => {
  it('muestra la carga inicial', () => {
    fetchClassrooms.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getAllByText('Cargando…').length).toBeGreaterThan(0)
  })

  it('lista las aulas con periodo, tutor y capacidad', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('5to A')).toBeTruthy())
    expect(screen.getByText('5to')).toBeTruthy()
    expect(screen.getByText('30')).toBeTruthy()
    expect(screen.getByText('2026')).toBeTruthy()
    expect(screen.getByText('Ana Docente')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy()
  })

  it('muestra el vacío y el error con reintento', async () => {
    fetchClassrooms.mockResolvedValue(page([]))
    renderPage()

    await waitFor(() => expect(screen.getByText('No hay aulas registradas.')).toBeTruthy())
    expect(screen.getByText('Crea la primera aula del periodo.')).toBeTruthy()
    cleanup()

    fetchClassrooms.mockReset()
    fetchClassrooms.mockRejectedValueOnce({ kind: 'server', status: 500, message: 'Falla de red' })
    renderPage()
    await waitFor(() => expect(screen.getByText('No se pudo cargar la información.')).toBeTruthy())

    fetchClassrooms.mockResolvedValue(page([classroom]))
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByText('5to A')).toBeTruthy())
  })

  it('crea un aula desde el modal con capacidad numérica', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('5to A')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /Nueva aula/ }))
    const dialog = screen.getByRole('dialog', { name: 'Nueva aula' })

    fireEvent.change(within(dialog).getByLabelText(/^Nombre/), { target: { value: '6to B' } })
    fireEvent.change(within(dialog).getByLabelText(/^Grado/), { target: { value: '6to' } })
    fireEvent.change(within(dialog).getByLabelText(/^Capacidad/), { target: { value: '28' } })
    await waitFor(() => expect(within(dialog).getByRole('option', { name: '2026 (vigente)' })).toBeTruthy())
    fireEvent.change(within(dialog).getByLabelText(/^Periodo académico/), { target: { value: '2' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(saveClassroom).toHaveBeenCalledWith(undefined, {
        name: '6to B',
        grade_level: '6to',
        capacity: 28,
        academic_period_id: 2,
        tutor_id: null,
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText('Aula creada.')).toBeTruthy()
    expect(fetchClassrooms).toHaveBeenCalledTimes(2)
  })

  it('edita un aula existente con los valores precargados', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('5to A')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const dialog = screen.getByRole('dialog', { name: 'Editar aula' })

    expect(within(dialog).getByLabelText(/^Nombre/).value).toBe('5to A')
    expect(within(dialog).getByLabelText(/^Grado/).value).toBe('5to')
    expect(within(dialog).getByLabelText(/^Capacidad/).value).toBe('30')

    fireEvent.change(within(dialog).getByLabelText(/^Nombre/), { target: { value: '5to A bis' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(saveClassroom).toHaveBeenCalledWith(4, {
        name: '5to A bis',
        grade_level: '5to',
        capacity: 30,
        academic_period_id: 2,
        tutor_id: 3,
      }),
    )
    expect(screen.getByText('Cambios guardados.')).toBeTruthy()
  })

  it('muestra los errores 422 por campo y mantiene el modal abierto', async () => {
    saveClassroom.mockRejectedValueOnce({
      status: 422,
      message: 'Datos inválidos',
      fieldErrors: { name: ['El nombre es obligatorio.'], capacity: ['Debe ser positiva.'] },
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('5to A')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /Nueva aula/ }))
    const dialog = screen.getByRole('dialog', { name: 'Nueva aula' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.getByText('El nombre es obligatorio.')).toBeTruthy())
    expect(screen.getByText('Debe ser positiva.')).toBeTruthy()
    expect(screen.getByText('Revisa los campos marcados.')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Nueva aula' })).toBeTruthy()
  })

  it('cancela la creación sin guardar y filtra por periodo', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('5to A')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /Nueva aula/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(saveClassroom).not.toHaveBeenCalled()

    await waitFor(() => expect(screen.getByRole('option', { name: '2026 (vigente)' })).toBeTruthy())
    fireEvent.change(screen.getByLabelText(/^Periodo$/), { target: { value: '2' } })
    await waitFor(() => expect(listCall({ academic_period_id: 2 })).toBe(true))
  })
})
