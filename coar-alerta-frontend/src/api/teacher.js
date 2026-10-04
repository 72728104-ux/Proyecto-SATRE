import { apiRequest } from './client.js'

const withQuery = (path, params = {}) => {
  const entries = Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  return entries.length ? `${path}?${new URLSearchParams(entries)}` : path
}

const today = () => {
  const date = new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/** Cursos del docente autenticado (cada uno trae su `classroom`). */
export const fetchTeacherCourses = (options) => apiRequest('/courses', options)

/** §4.3: hoja de matrículas + asistencia del día (`GET /attendances/session`). */
export const fetchAttendanceSession = (courseId, attendanceDate, options) =>
  apiRequest(withQuery('/attendances/session', { course_id: courseId, attendance_date: attendanceDate }), options)

export const saveAttendanceSession = (body) => apiRequest('/attendances/session', { method: 'POST', body })

/** Estudiantes con matrícula activa en el curso (la fecha solo arma la hoja; no filtra matrículas). */
export const fetchCourseRoster = (courseId, options) =>
  fetchAttendanceSession(courseId, today(), options).then((payload) => payload.data?.students ?? [])

export const fetchGrades = (params, options) => apiRequest(withQuery('/grades', params), options)
export const saveGrade = (id, body) => apiRequest(id ? `/grades/${id}` : '/grades', { method: id ? 'PUT' : 'POST', body })

/** `{ available, data }`; `data` sigue el contrato §5.4 (vista completa para docentes). */
export const fetchStudentRisk = (studentId, options) =>
  apiRequest(`/ai-analytics/students/${studentId}/risk`, { silent: true, ...options })

/** `{ available, stale, generated_at, data: { insufficient_data, courses, top_gaps, error_matrix } }`. */
export const fetchClassroomInsights = (classroomId, options) =>
  apiRequest(`/ai-analytics/teacher/insights/${classroomId}`, { silent: true, ...options })

/**
 * Contrato esperado (§4.4): `{ data: { insufficient_data, summary: { students, grade_mean, pass_rate, attendance_rate,
 * open_alerts }, risk_distribution: { ALTO, MEDIO, BAJO }, courses: [{ course_id, course_name, grade_mean, pass_rate,
 * attendance_rate }] } }`.
 */
export const fetchClassroomAnalytics = (classroomId, options) =>
  apiRequest(`/reports/classrooms/${classroomId}/analytics`, options)

export const exportClassroomReport = (classroomId, format) =>
  apiRequest(withQuery(`/reports/classrooms/${classroomId}/export`, { format }), { responseType: 'blob', timeout: 60000 })

/**
 * Contrato esperado (§4.5): alerta `{ id, student: { id, name }, severity, title, message, status, created_at,
 * interventions: [{ id, type, description, status, created_at, follow_ups: [{ id, follow_up_date, outcome, notes }] }] }`.
 */
export const fetchAlerts = (params, options) => apiRequest(withQuery('/alerts', params), options)
export const updateAlert = (id, body) => apiRequest(`/alerts/${id}`, { method: 'PATCH', body })
export const createIntervention = (alertId, body) =>
  apiRequest(`/alerts/${alertId}/interventions`, { method: 'POST', body })
export const createFollowUp = (interventionId, body) =>
  apiRequest(`/interventions/${interventionId}/follow-ups`, { method: 'POST', body })
