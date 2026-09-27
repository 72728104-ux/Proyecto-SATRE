import { apiRequest } from './client.js'

const withQuery = (path, params = {}) => {
  const entries = Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  return entries.length ? `${path}?${new URLSearchParams(entries)}` : path
}

/**
 * `{ data: { student, academic_period, courses: [{ id, code, name }], grades: { average, scale, failing_courses,
 * by_course: [{ course_id, course_name, average, passing, count, criteria: { A..D } }] }, attendance: { total,
 * by_status, rate }, alerts: { open, items } } }`.
 */
export const fetchMySummary = (options) => apiRequest('/me/summary', options)

/** El backend filtra por el estudiante autenticado; paginado de 15. */
export const fetchMyGrades = (params, options) => apiRequest(withQuery('/grades', params), options)
export const fetchMyAttendances = (params, options) => apiRequest(withQuery('/attendances', params), options)
export const fetchMyPresences = (params, options) => apiRequest(withQuery('/presences', params), options)

export const fetchMyPermissions = (params, options) => apiRequest(withQuery('/permissions', params), options)
/** `{ type, reason, starts_at, ends_at }`; queda `pending_guardian` hasta que el apoderado responda. */
export const createPermission = (body) => apiRequest('/permissions', { method: 'POST', body })

/**
 * `{ course_id, topic }` inicia sesión; `{ session_id, message? | option_id? }` continúa.
 * Responde `{ available, data: { session, reply: { type, text, options? }, done } }`; `available:false` si el motor cae.
 */
export const sendTutorTurn = (body) => apiRequest('/ai-analytics/student/socratic-tutor', { method: 'POST', body })
export const fetchTutorSessions = (params, options) =>
  apiRequest(withQuery('/ai-analytics/student/socratic-tutor/sessions', params), options)
