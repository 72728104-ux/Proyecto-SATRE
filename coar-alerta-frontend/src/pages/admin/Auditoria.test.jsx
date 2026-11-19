import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import Auditoria from './Auditoria'
import { fetchAuditLogs, fetchUsers } from '../../api/admin'

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

const rows = [
  {
    id: 1,
    action: 'grade.updated',
    created_at: '2026-05-10T10:30:00Z',
    user: { name: 'Ana Torres' },
    auditable_type: 'App\\Models\\Grade',
    auditable_id: 9,
    old_values: { score: 10, meta: { origen: 'manual' } },
    new_values: { score: 15 },
    ip_address: '127.0.0.1',
  },
  {
    id: 2,
    action: 'user.created',
    created_at: null,
    user: null,
    auditable_type: null,
    auditable_id: null,
    old_values: null,
    new_values: null,
    ip_address: null,
  },
]

const certRow = {
  id: 3,
  action: 'user.deleted',
  created_at: '2026-05-09T08:00:00Z',
  user: { name: 'Beto Ríos' },
  auditable_type: 'App\\Models\\User',
  auditable_id: 4,
  old_values: { active: true },
  new_values: { active: false },
  ip_address: '127.0.0.1',
}

const renderPage = () =>
  render(
    <ToastProvider>
      <Auditoria />
    </ToastProvider>,
  )

const listCall = (matcher) =>
  fetchAuditLogs.mock.calls.some(([params]) => Object.entries(matcher).every(([key, value]) => params?.[key] === value))

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
  fetchAuditLogs.mockResolvedValue(page(rows))
  fetchUsers.mockResolvedValue({ data: [{ id: 7, name: 'Ana Torres', email: 'ana@coar.edu.pe' }] })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Auditoria', () => {
  it('muestra la carga mientras llega la primera página', async () => {
    fetchAuditLogs.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('heading', { name: 'Auditoría' })).toBeTruthy()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('lista acciones, usuario, recurso, cambios e IP', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('grade.updated')).toBeTruthy())
    expect(screen.getByText('Ana Torres')).toBeTruthy()
    expect(screen.getByText('Grade #9')).toBeTruthy()
    expect(screen.getByText('2 campos')).toBeTruthy()
    expect(screen.getByText('127.0.0.1')).toBeTruthy()
    expect(screen.getByText('{"origen":"manual"}')).toBeTruthy()
    expect(screen.getByText('10')).toBeTruthy()
    expect(screen.getByText('15')).toBeTruthy()

    expect(screen.getByText('user.created')).toBeTruthy()
    expect(screen.getByText('Sistema')).toBeTruthy()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
  })

  it('pluraliza los cambios y permite abrir el detalle', async () => {
    fetchAuditLogs.mockResolvedValue(page([certRow]))
    renderPage()

    await waitFor(() => expect(screen.getByText('user.deleted')).toBeTruthy())
    const summary = screen.getByText('1 campo')
    fireEvent.click(summary)
    expect(screen.getByText('active:')).toBeTruthy()
    expect(screen.getByText('true')).toBeTruthy()
    expect(screen.getByText('false')).toBeTruthy()

    fetchAuditLogs.mockResolvedValue(page([{ ...certRow, id: 4, old_values: { a: 1, b: 2 }, new_values: null }]))
    cleanup()
    renderPage()
    await waitFor(() => expect(screen.getByText('2 campos')).toBeTruthy())
  })

  it('muestra el vacío cuando no hay registros', async () => {
    fetchAuditLogs.mockResolvedValue(page([]))
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('No hay registros de auditoría con esos filtros.')).toBeTruthy(),
    )
  })

  it('muestra el error y reintenta la carga', async () => {
    fetchAuditLogs.mockRejectedValueOnce({ kind: 'server', status: 500, message: 'Fallo el servidor' })
    renderPage()

    await waitFor(() => expect(screen.getByText('No se pudo cargar la información.')).toBeTruthy())
    await waitFor(() => expect(screen.getByText('Fallo el servidor')).toBeTruthy())
    expect(fetchAuditLogs).toHaveBeenCalledTimes(1)

    fetchAuditLogs.mockResolvedValue(page(rows))
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(screen.getByText('grade.updated')).toBeTruthy())
    expect(fetchAuditLogs).toHaveBeenCalledTimes(2)
  })

  it('filtra por acción, fechas y usuario, y vuelve a la primera página', async () => {
    fetchAuditLogs.mockResolvedValue({
      ...page(rows),
      meta: { current_page: 1, last_page: 3, total: 40, from: 1, to: 15, per_page: 15 },
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('grade.updated')).toBeTruthy())

    fireEvent.change(screen.getByLabelText(/^Acción/), { target: { value: 'user.' } })
    await waitFor(() => expect(listCall({ action: 'user.' })).toBe(true))

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-01' } })
    await waitFor(() => expect(listCall({ action: 'user.', date_from: '2026-01-01' })).toBe(true))

    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-06-30' } })
    await waitFor(() => expect(listCall({ date_to: '2026-06-30', page: 1 })).toBe(true))

    await waitFor(() => expect(screen.getByRole('option', { name: 'Ana Torres · ana@coar.edu.pe' })).toBeTruthy())
    fireEvent.change(screen.getByRole('combobox', { name: 'Usuario' }), { target: { value: '7' } })
    await waitFor(() => expect(listCall({ user_id: 7 })).toBe(true))
  })

  it('pagina a la siguiente página', async () => {
    fetchAuditLogs.mockResolvedValue({
      ...page(rows),
      meta: { current_page: 1, last_page: 2, total: 20, from: 1, to: 15, per_page: 15 },
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('grade.updated')).toBeTruthy())

    const nav = screen.getByRole('navigation', { name: 'Paginación' })
    expect(within(nav).getByText('Mostrando 1–15 de 20')).toBeTruthy()

    fireEvent.click(within(nav).getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(listCall({ page: 2 })).toBe(true))
  })
})
