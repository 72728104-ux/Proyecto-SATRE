import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import Cursos from './Cursos'
import {
  fetchClassrooms,
  fetchCourses,
  fetchPeriods,
  fetchUsers,
  saveCourse,
} from '../../api/admin'

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

const course = {
  id: 8,
  code: 'MAT-5A',
  name: 'Matemáticas',
  academic_period: { id: 2, name: '2026' },
  classroom: { id: 4, name: '5to A' },
  teacher: { id: 3, name: 'Ana Docente' },
}

const renderPage = () =>
  render(
    <ToastProvider>
      <Cursos />
    </ToastProvider>,
  )

const courseCall = (matcher) =>
  fetchCourses.mock.calls.some(([params]) => Object.entries(matcher).every(([key, value]) => params?.[key] === value))

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
  fetchCourses.mockResolvedValue(page([course]))
  fetchClassrooms.mockResolvedValue({ data: [{ id: 4, name: '5to A', grade_level: '5to' }] })
  fetchPeriods.mockResolvedValue({ data: [{ id: 2, name: '2026', is_current: true }] })
  fetchUsers.mockResolvedValue({
    data: [{ id: 3, profile_id: 3, name: 'Ana Docente', email: 'ana@coar.edu.pe' }],
  })
  saveCourse.mockResolvedValue({ data: course })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Cursos', () => {
  it('muestra la carga y el vacío', async () => {
    fetchCourses.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getAllByText('Cargando…').length).toBeGreaterThan(0)
    cleanup()

    fetchCourses.mockReset()
    fetchCourses.mockResolvedValue(page([]))
    renderPage()
    await waitFor(() => expect(screen.getByText('No hay cursos con esos filtros.')).toBeTruthy())
    expect(screen.getByText('Crea un curso y asígnale docente y aula.')).toBeTruthy()
  })

  it('lista los cursos con código, aula, docente y periodo', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('MAT-5A · Matemáticas')).toBeTruthy())
    expect(screen.getByText('5to A')).toBeTruthy()
    expect(screen.getByText('Ana Docente')).toBeTruthy()
    expect(screen.getByText('2026')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy()
  })

  it('muestra el error de carga y reintenta', async () => {
    fetchCourses.mockRejectedValueOnce({ kind: 'server', status: 500, message: 'Falla de red' })
    renderPage()

    await waitFor(() => expect(screen.getByText('No se pudo cargar la información.')).toBeTruthy())
    fetchCourses.mockResolvedValue(page([course]))
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByText('MAT-5A · Matemáticas')).toBeTruthy())
  })

  it('crea un curso: el aula espera al periodo y se envían todos los ids', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('MAT-5A · Matemáticas')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /Nuevo curso/ }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo curso' })

    const classroomSelect = within(dialog).getByLabelText(/^Aula/)
    expect(classroomSelect.disabled).toBe(true)
    expect(within(dialog).getByRole('option', { name: 'Primero elige un periodo' })).toBeTruthy()

    fireEvent.change(within(dialog).getByLabelText(/^Código/), { target: { value: 'MAT-6B' } })
    fireEvent.change(within(dialog).getByLabelText(/^Nombre/), { target: { value: 'Matemáticas II' } })
    await waitFor(() => expect(within(dialog).getByRole('option', { name: '2026 (vigente)' })).toBeTruthy())
    fireEvent.change(within(dialog).getByLabelText(/^Periodo académico/), { target: { value: '2' } })

    await waitFor(() => expect(within(dialog).getByLabelText(/^Aula/).disabled).toBe(false))
    await waitFor(() => expect(within(dialog).getByRole('option', { name: '5to A · 5to' })).toBeTruthy())
    await waitFor(() =>
      expect(within(dialog).getByRole('option', { name: 'Ana Docente · ana@coar.edu.pe' })).toBeTruthy(),
    )

    fireEvent.change(within(dialog).getByLabelText(/^Aula/), { target: { value: '4' } })
    fireEvent.change(within(dialog).getByRole('combobox', { name: /^Docente/ }), { target: { value: '3' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(saveCourse).toHaveBeenCalledWith(undefined, {
        code: 'MAT-6B',
        name: 'Matemáticas II',
        academic_period_id: 2,
        classroom_id: 4,
        teacher_id: 3,
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText('Curso creado.')).toBeTruthy()
  })

  it('edita un curso precargado', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('MAT-5A · Matemáticas')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const dialog = screen.getByRole('dialog', { name: 'Editar curso' })

    expect(within(dialog).getByLabelText(/^Código/).value).toBe('MAT-5A')
    expect(within(dialog).getByLabelText(/^Nombre/).value).toBe('Matemáticas')
    await waitFor(() => expect(within(dialog).getByRole('option', { name: '2026 (vigente)' })).toBeTruthy())
    await waitFor(() => expect(within(dialog).getByRole('option', { name: '5to A · 5to' })).toBeTruthy())
    expect(within(dialog).getByLabelText(/^Periodo académico/).value).toBe('2')
    expect(within(dialog).getByLabelText(/^Aula/).value).toBe('4')

    fireEvent.change(within(dialog).getByLabelText(/^Nombre/), { target: { value: 'Matemáticas avanzadas' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(saveCourse).toHaveBeenCalledWith(8, {
        code: 'MAT-5A',
        name: 'Matemáticas avanzadas',
        academic_period_id: 2,
        classroom_id: 4,
        teacher_id: 3,
      }),
    )
    expect(screen.getByText('Cambios guardados.')).toBeTruthy()
  })

  it('muestra los errores 422 del backend en los campos', async () => {
    saveCourse.mockRejectedValueOnce({
      status: 422,
      message: 'Datos inválidos',
      fieldErrors: { code: ['El código ya existe.'], teacher_id: ['Selecciona un docente.'] },
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('MAT-5A · Matemáticas')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /Nuevo curso/ }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo curso' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.getByText('El código ya existe.')).toBeTruthy())
    expect(screen.getByText('Selecciona un docente.')).toBeTruthy()
    expect(screen.getByText('Revisa los campos marcados.')).toBeTruthy()
  })

  it('filtra por periodo y aula', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('MAT-5A · Matemáticas')).toBeTruthy())

    await waitFor(() => expect(screen.getByRole('option', { name: '2026 (vigente)' })).toBeTruthy())
    fireEvent.change(screen.getByLabelText(/^Periodo$/), { target: { value: '2' } })
    await waitFor(() => expect(courseCall({ academic_period_id: 2, page: 1 })).toBe(true))

    await waitFor(() => expect(screen.getByRole('option', { name: '5to A · 5to' })).toBeTruthy())
    fireEvent.change(screen.getByRole('combobox', { name: 'Aula' }), { target: { value: '4' } })
    await waitFor(() => expect(courseCall({ academic_period_id: 2, classroom_id: 4 })).toBe(true))
  })
})
