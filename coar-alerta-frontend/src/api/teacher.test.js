import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client.js', () => ({ apiRequest: vi.fn() }))

const { apiRequest } = await import('./client.js')
const {
  createFollowUp,
  createIntervention,
  exportClassroomReport,
  fetchAlerts,
  fetchAttendanceSession,
  fetchClassroomAnalytics,
  fetchClassroomInsights,
  fetchClassroomRisk,
  fetchCourseRoster,
  fetchGrades,
  fetchStudentRisk,
  fetchTeacherCourses,
  saveAttendanceSession,
  saveGrade,
  sendTeacherAssistant,
  updateAlert,
} = await import('./teacher.js')

const signal = new AbortController().signal

describe('api/teacher', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    apiRequest.mockResolvedValue({ data: [] })
  })

  afterEach(() => {
    apiRequest.mockReset()
  })

  it('fetchTeacherCourses pide 100 cursos por defecto y respeta opciones', async () => {
    await fetchTeacherCourses()
    expect(apiRequest).toHaveBeenCalledWith('/courses?per_page=100', {})

    await fetchTeacherCourses({ per_page: 20, signal, silent: true })
    expect(apiRequest).toHaveBeenCalledWith('/courses?per_page=20', { signal, silent: true })
  })

  it('fetchAttendanceSession arma la query de curso y fecha', async () => {
    await fetchAttendanceSession(7, '2026-04-10', { signal })
    expect(apiRequest).toHaveBeenCalledWith(
      '/attendances/session?course_id=7&attendance_date=2026-04-10',
      { signal },
    )
  })

  it('saveAttendanceSession envía el cuerpo por POST', async () => {
    const body = { course_id: 7, attendance_date: '2026-04-10', records: [] }
    await saveAttendanceSession(body)
    expect(apiRequest).toHaveBeenCalledWith('/attendances/session', { method: 'POST', body })
  })

  it('fetchCourseRoster devuelve solo los estudiantes de la hoja del día', async () => {
    apiRequest.mockResolvedValueOnce({ data: { students: [{ student_id: 3 }] } })
    const result = await fetchCourseRoster(7, { signal })

    expect(result).toEqual([{ student_id: 3 }])
    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringMatching(/^\/attendances\/session\?course_id=7&attendance_date=\d{4}-\d{2}-\d{2}$/),
      { signal },
    )
  })

  it('fetchCourseRoster tolera payloads sin estudiantes', async () => {
    apiRequest.mockResolvedValueOnce({})
    await expect(fetchCourseRoster(7)).resolves.toEqual([])

    apiRequest.mockResolvedValueOnce({ data: {} })
    await expect(fetchCourseRoster(7)).resolves.toEqual([])
  })

  it('fetchGrades y saveGrade construyen la query y el verbo correctos', async () => {
    await fetchGrades({ course_id: 7, page: 2 })
    expect(apiRequest).toHaveBeenCalledWith('/grades?course_id=7&page=2', undefined)

    const body = { score: 16.5 }
    await saveGrade(null, body)
    expect(apiRequest).toHaveBeenCalledWith('/grades', { method: 'POST', body })

    await saveGrade(9, body)
    expect(apiRequest).toHaveBeenCalledWith('/grades/9', { method: 'PUT', body })
  })

  it('fetchStudentRisk es silencioso y añade refresh=1 solo al forzar', async () => {
    await fetchStudentRisk(3)
    expect(apiRequest).toHaveBeenCalledWith('/ai-analytics/students/3/risk', { silent: true })

    await fetchStudentRisk(3, { refresh: true, signal })
    expect(apiRequest).toHaveBeenCalledWith('/ai-analytics/students/3/risk?refresh=1', {
      silent: true,
      signal,
    })
  })

  it('fetchClassroomRisk agrupa el aula en una sola llamada silenciosa', async () => {
    await fetchClassroomRisk(1)
    expect(apiRequest).toHaveBeenCalledWith('/ai-analytics/classrooms/1/risk', { silent: true })

    await fetchClassroomRisk(1, { refresh: true, signal })
    expect(apiRequest).toHaveBeenCalledWith('/ai-analytics/classrooms/1/risk?refresh=1', {
      silent: true,
      signal,
    })
  })

  it('fetchClassroomInsights y fetchClassroomAnalytics apuntan al aula', async () => {
    await fetchClassroomInsights(1)
    expect(apiRequest).toHaveBeenCalledWith('/ai-analytics/teacher/insights/1', { silent: true })

    await fetchClassroomInsights(1, { signal })
    expect(apiRequest).toHaveBeenCalledWith('/ai-analytics/teacher/insights/1', { silent: true, signal })

    await fetchClassroomAnalytics(1, { signal })
    expect(apiRequest).toHaveBeenCalledWith('/reports/classrooms/1/analytics', { signal })
  })

  it('sendTeacherAssistant usa timeout largo y modo silencioso', async () => {
    const body = { prompt: '¿Cómo mejoro el aula?' }
    await sendTeacherAssistant(body)
    expect(apiRequest).toHaveBeenCalledWith('/v1/analytics/teacher-assistant', {
      method: 'POST',
      body,
      timeout: 60000,
      silent: true,
    })

    await sendTeacherAssistant(body, { timeout: 1000 })
    expect(apiRequest).toHaveBeenLastCalledWith('/v1/analytics/teacher-assistant', {
      method: 'POST',
      body,
      timeout: 1000,
      silent: true,
    })
  })

  it('exportClassroomReport pide un blob con timeout extendido', async () => {
    await exportClassroomReport(1, 'csv')
    expect(apiRequest).toHaveBeenCalledWith('/reports/classrooms/1/export?format=csv', {
      responseType: 'blob',
      timeout: 60000,
    })
  })

  it('las alertas usan los endpoints del contrato §4.5', async () => {
    await fetchAlerts({ status: 'open', page: 1 }, { signal })
    expect(apiRequest).toHaveBeenCalledWith('/alerts?status=open&page=1', { signal })

    await updateAlert(4, { status: 'resolved' })
    expect(apiRequest).toHaveBeenCalledWith('/alerts/4', { method: 'PATCH', body: { status: 'resolved' } })

    await createIntervention(4, { type: 'tutoria' })
    expect(apiRequest).toHaveBeenCalledWith('/alerts/4/interventions', {
      method: 'POST',
      body: { type: 'tutoria' },
    })

    await createFollowUp(8, { notes: 'Mejora' })
    expect(apiRequest).toHaveBeenCalledWith('/interventions/8/follow-ups', {
      method: 'POST',
      body: { notes: 'Mejora' },
    })
  })
})
