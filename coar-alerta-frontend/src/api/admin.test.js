import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client.js', () => ({ apiRequest: vi.fn() }))

const { apiRequest } = await import('./client.js')
const api = await import('./admin.js')

beforeEach(() => {
  apiRequest.mockReset()
  apiRequest.mockResolvedValue({ ok: true })
})

describe('api/admin', () => {
  it('consulta métricas y usuarios con query string filtrada', async () => {
    const signal = new AbortController().signal
    await api.fetchAdminMetrics({ signal })
    expect(apiRequest).toHaveBeenCalledWith('/admin/metrics', { signal })

    await api.fetchUsers({ role: 'teacher', search: 'ana', is_active: undefined, page: 2 })
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/users?role=teacher&search=ana&page=2', undefined)

    await api.fetchUsers({ role: '', search: null })
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/users', undefined)
  })

  it('guarda usuarios con POST al crear y PUT al editar', async () => {
    const body = { name: 'Ana Docente', dni: '12345678' }
    await api.saveUser(undefined, body)
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/users', { method: 'POST', body })

    await api.saveUser(12, body)
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/users/12', { method: 'PUT', body })
  })

  it('activa/desactiva y restablece contraseñas', async () => {
    await api.toggleUserActive(7)
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/users/7/toggle-active', { method: 'PATCH' })

    await api.resetUserPassword(7)
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/users/7/reset-password', { method: 'POST' })
  })

  it('consulta y guarda aulas', async () => {
    await api.fetchClassrooms({ academic_period_id: 2, page: 1 }, { signal: 's' })
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/classrooms?academic_period_id=2&page=1', { signal: 's' })

    const body = { name: '5to A', grade_level: '5to' }
    await api.saveClassroom(undefined, body)
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/classrooms', { method: 'POST', body })

    await api.saveClassroom(4, body)
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/classrooms/4', { method: 'PUT', body })
  })

  it('consulta y guarda cursos', async () => {
    await api.fetchCourses({ academic_period_id: 2, classroom_id: 4 })
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/courses?academic_period_id=2&classroom_id=4', undefined)

    const body = { code: 'MAT-5A', name: 'Matemáticas' }
    await api.saveCourse(undefined, body)
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/courses', { method: 'POST', body })

    await api.saveCourse(9, body)
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/courses/9', { method: 'PUT', body })
  })

  it('consulta periodos, los guarda y cambia el vigente', async () => {
    await api.fetchPeriods()
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/periods', undefined)

    const body = { name: '2026', start_date: '2026-03-01', end_date: '2026-12-20' }
    await api.savePeriod(undefined, body)
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/periods', { method: 'POST', body })

    await api.savePeriod(2, body)
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/periods/2', { method: 'PUT', body })

    await api.setCurrentPeriod(2)
    expect(apiRequest).toHaveBeenLastCalledWith('/admin/periods/2/set-current', { method: 'POST' })
  })

  it('consulta la auditoría con filtros', async () => {
    await api.fetchAuditLogs({ user_id: 3, action: 'grade.', date_from: '', date_to: null, page: 1 }, { signal: 's' })
    expect(apiRequest).toHaveBeenLastCalledWith(
      '/admin/audit-logs?user_id=3&action=grade.&page=1',
      { signal: 's' },
    )
  })
})
