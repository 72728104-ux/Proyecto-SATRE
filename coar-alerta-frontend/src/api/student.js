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

/** Vista reducida §1: `{ id, severity, message, status, created_at }` (sin título ni intervenciones). */
export const fetchMyAlerts = (params, options) => apiRequest(withQuery('/alerts', params), options)

/** Vista reducida §1: `{ available, data: { student_id, risk_level, recommendation, predicted_at } }`. */
export const fetchMyRisk = (studentId, options) =>
  apiRequest(`/ai-analytics/students/${studentId}/risk`, { silent: true, ...options })

/** CREATE-SATRE §12.2: lecturas del periodo (el backend filtra por matrícula del estudiante). */
export const fetchReadings = (params, options) => apiRequest(withQuery('/readings', params), options)
export const fetchReadingArtifacts = (readingId, params, options) =>
  apiRequest(withQuery(`/readings/${readingId}/artifacts`, params), options)
export const submitReadingArtifact = (readingId, body) =>
  apiRequest(`/readings/${readingId}/artifacts`, { method: 'POST', body })
export const fetchReadingQuestions = (readingId, params, options) =>
  apiRequest(withQuery(`/readings/${readingId}/questions`, params), options)
export const submitGuidedResponse = (readingId, body) =>
  apiRequest(`/readings/${readingId}/questions`, { method: 'POST', body })
export const fetchReadingQuizAttempts = (readingId, params, options) =>
  apiRequest(withQuery(`/readings/${readingId}/quiz`, params), options)
export const submitReadingQuiz = (readingId, body) =>
  apiRequest(`/readings/${readingId}/quiz`, { method: 'POST', body })

/**
 * `{ course_id, topic, criterion? }` inicia sesión; `{ session_id, message? | option_id? }` continúa.
 * Responde `{ available, data: { session, reply: { type, text, options?, create_phase?, quiz?, diagram_mermaid?, reflection? }, done } }`.
 */
export const sendTutorTurn = (body) => apiRequest('/ai-analytics/student/socratic-tutor', { method: 'POST', body })
export const fetchTutorSessions = (params, options) =>
  apiRequest(withQuery('/ai-analytics/student/socratic-tutor/sessions', params), options)

/** Body de `POST /ai-analytics/student/socratic-tutor` (§12.2 paso 5, §12.3). */
export function buildTutorStartBody({ course_id, topic, criterion }) {
  const body = { course_id, topic }
  if (criterion) body.criterion = criterion
  return body
}

/** Pistas / diagrama / quiz usan el `message` ya previsto en §4.6 (sin parámetros nuevos). */
export function buildTutorIntentBody(sessionId, message) {
  return { session_id: sessionId, message }
}

export function tutorSeedFromReading(reading) {
  return buildTutorStartBody({
    course_id: reading.course_id,
    topic: reading.title,
    criterion: reading.criterion,
  })
}

export function tutorPathFromReading(reading) {
  const seed = tutorSeedFromReading(reading)
  const params = new URLSearchParams({ course_id: String(seed.course_id), topic: seed.topic })
  if (seed.criterion) params.set('criterion', seed.criterion)
  return `/estudiante/tutor?${params}`
}

export function tutorSeedFromSearch(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search)
  const courseId = Number(params.get('course_id'))
  const topic = params.get('topic')?.trim() ?? ''
  const criterion = params.get('criterion')?.trim()?.toUpperCase() || null
  if (!Number.isInteger(courseId) || courseId <= 0 || !topic) return null
  return buildTutorStartBody({ course_id: courseId, topic, criterion })
}
