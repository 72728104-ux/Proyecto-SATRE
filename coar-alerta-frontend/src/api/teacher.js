import { apiRequest } from './client.js'

/** satre-analytics (uvicorn). Laravel queda en :8000; el motor en :8001. */
const ANALYTICS_API_URL = String(import.meta.env.VITE_ANALYTICS_API_URL ?? 'http://127.0.0.1:8001').replace(/\/+$/, '')
const INTERNAL_KEY = import.meta.env.VITE_INTERNAL_KEY || 'clave_secreta_super_segura_de_mas_de_32_caracteres_12345'

const withQuery = (path, params = {}) => {
  const entries = Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  return entries.length ? `${path}?${new URLSearchParams(entries)}` : path
}

const today = () => new Date().toISOString().slice(0, 10)

/** Cursos del docente autenticado (cada uno trae su `classroom`). */
export const fetchTeacherCourses = (options) => apiRequest('/courses', options)

/** Estudiantes con matrícula activa en el curso (se reutiliza la hoja de asistencia del día). */
export const fetchCourseRoster = (courseId, options) =>
  apiRequest(withQuery(`/courses/${courseId}/attendance-session`, { attendance_date: today() }), options).then(
    (payload) => payload.data?.students ?? [],
  )

export const fetchGrades = (params, options) => apiRequest(withQuery('/grades', params), options)
export const saveGrade = (id, body) => apiRequest(id ? `/grades/${id}` : '/grades', { method: id ? 'PUT' : 'POST', body })

/** `{ available, data }`; `data` sigue el contrato §5.4 (vista completa para docentes). */
export const fetchStudentRisk = (studentId, options) =>
  apiRequest(`/ai-analytics/students/${studentId}/risk`, { silent: true, ...options })

/** `{ available, stale, generated_at, data: { insufficient_data, courses, top_gaps, error_matrix } }`. */
export async function fetchClassroomInsights(classroomId, options = {}) {
  const url = `${ANALYTICS_API_URL}/v1/classrooms/${classroomId}/insights`
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Internal-Key': INTERNAL_KEY,
      },
      signal: options.signal,
    })
    if (!response.ok) {
      console.error('Analytics request failed', { url, status: response.status })
      return { available: false, stale: false, generated_at: null, data: null }
    }
    const payload = await response.json()
    return {
      available: true,
      stale: false,
      generated_at: payload.generated_at ?? null,
      data: payload,
    }
  } catch (error) {
    if (options.signal?.aborted || error?.name === 'AbortError') throw error
    console.error('Analytics request failed', { url, status: 0 })
    return { available: false, stale: false, generated_at: null, data: null }
  }
}

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
