import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, apiRequest: vi.fn() }
})

const { apiRequest } = await import('./client.js')
const {
  buildTutorIntentBody,
  buildTutorStartBody,
  createPermission,
  deleteTutorSession,
  fetchMyAlerts,
  fetchMyAttendances,
  fetchMyGrades,
  fetchMyPermissions,
  fetchMyPresences,
  fetchMyRisk,
  fetchMySummary,
  fetchReadingArtifacts,
  fetchReadingQuestions,
  fetchReadingQuizAttempts,
  fetchReadings,
  fetchTutorSessions,
  sendTutorTurn,
  submitGuidedResponse,
  submitReadingArtifact,
  submitReadingQuiz,
  tutorPathFromReading,
  tutorSeedFromReading,
  tutorSeedFromSearch,
} = await import('./student.js')

const signal = new AbortController().signal

describe('api/student', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    apiRequest.mockResolvedValue({ data: [] })
  })

  afterEach(() => {
    apiRequest.mockReset()
  })

  it('consulta el resumen del estudiante sin parámetros', async () => {
    await fetchMySummary({ signal })
    expect(apiRequest).toHaveBeenCalledWith('/me/summary', { signal })
  })

  it('arma el query string de los listados paginados y omite filtros vacíos', async () => {
    await fetchMyGrades({ course_id: 5, criterion: 'A', page: 2 }, { signal })
    expect(apiRequest).toHaveBeenLastCalledWith('/grades?course_id=5&criterion=A&page=2', { signal })

    await fetchMyAttendances({ status: 'late', course_id: '' }, { signal })
    expect(apiRequest).toHaveBeenLastCalledWith('/attendances?status=late', { signal })

    await fetchMyPresences({ status: 'present', check_type: 'night' }, { signal })
    expect(apiRequest).toHaveBeenLastCalledWith('/presences?status=present&check_type=night', { signal })

    await fetchMyPermissions({ status: null, page: 1 }, { signal })
    expect(apiRequest).toHaveBeenLastCalledWith('/permissions?page=1', { signal })

    await fetchMyAlerts(undefined)
    expect(apiRequest).toHaveBeenLastCalledWith('/alerts', undefined)
  })

  it('crea una solicitud de permiso con POST y body JSON', async () => {
    const body = { type: 'salida', reason: 'Cita', starts_at: '2026-04-10T13:00:00.000Z', ends_at: '2026-04-10T18:00:00.000Z' }
    await createPermission(body)
    expect(apiRequest).toHaveBeenCalledWith('/permissions', { method: 'POST', body })
  })

  it('consulta el riesgo con la opción silent por defecto', async () => {
    await fetchMyRisk(3, { signal })
    expect(apiRequest).toHaveBeenCalledWith('/ai-analytics/students/3/risk', { silent: true, signal })

    await fetchMyRisk(3, { silent: false })
    expect(apiRequest).toHaveBeenLastCalledWith('/ai-analytics/students/3/risk', { silent: false })
  })

  it('consulta las lecturas y sus recursos anidados', async () => {
    await fetchReadings({ course_id: 5 }, { signal })
    expect(apiRequest).toHaveBeenLastCalledWith('/readings?course_id=5', { signal })

    await fetchReadingArtifacts(9, { page: 1 }, { signal })
    expect(apiRequest).toHaveBeenLastCalledWith('/readings/9/artifacts?page=1', { signal })

    await fetchReadingQuestions(9, {}, { signal })
    expect(apiRequest).toHaveBeenLastCalledWith('/readings/9/questions', { signal })

    await fetchReadingQuizAttempts(9, { page: 1 }, { signal })
    expect(apiRequest).toHaveBeenLastCalledWith('/readings/9/quiz?page=1', { signal })
  })

  it('envía el mapa, las respuestas guía y el quiz de una lectura', async () => {
    const map = { nodes: [{ id: 'n1', label: 'A' }], connections: [] }
    await submitReadingArtifact(9, map)
    expect(apiRequest).toHaveBeenLastCalledWith('/readings/9/artifacts', { method: 'POST', body: map })

    const response = { guided_question_id: 11, response: 'a' }
    await submitGuidedResponse(9, response)
    expect(apiRequest).toHaveBeenLastCalledWith('/readings/9/questions', { method: 'POST', body: response })

    const quiz = { answers: [{ guided_question_id: 11, response: 'a' }] }
    await submitReadingQuiz(9, quiz)
    expect(apiRequest).toHaveBeenLastCalledWith('/readings/9/quiz', { method: 'POST', body: quiz })
  })

  it('delega las sesiones de tutor socrático', async () => {
    await sendTutorTurn({ session_id: 1, message: 'Hola' })
    expect(apiRequest).toHaveBeenLastCalledWith('/ai-analytics/student/socratic-tutor', {
      method: 'POST',
      body: { session_id: 1, message: 'Hola' },
    })

    await fetchTutorSessions({ page: 1 }, { signal })
    expect(apiRequest).toHaveBeenLastCalledWith('/ai-analytics/student/socratic-tutor/sessions?page=1', { signal })

    await deleteTutorSession(7)
    expect(apiRequest).toHaveBeenLastCalledWith('/v1/socratic/sessions/7', { method: 'DELETE' })
  })
})

describe('helpers del tutor socrático', () => {
  it('construye el body inicial con criterio opcional', () => {
    expect(buildTutorStartBody({ course_id: 5, topic: 'Funciones' })).toEqual({ course_id: 5, topic: 'Funciones' })
    expect(buildTutorStartBody({ course_id: 5, topic: 'Funciones', criterion: 'A' })).toEqual({
      course_id: 5,
      topic: 'Funciones',
      criterion: 'A',
    })
  })

  it('construye el body de continuación', () => {
    expect(buildTutorIntentBody(12, 'Dame una pista')).toEqual({ session_id: 12, message: 'Dame una pista' })
  })

  it('deriva la semilla y la ruta desde una lectura', () => {
    const reading = { course_id: 5, title: 'Pendiente y cambio', criterion: 'B' }
    expect(tutorSeedFromReading(reading)).toEqual({ course_id: 5, topic: 'Pendiente y cambio', criterion: 'B' })

    expect(tutorPathFromReading(reading)).toBe(
      '/estudiante/tutor?course_id=5&topic=Pendiente+y+cambio&criterion=B',
    )
    expect(tutorPathFromReading({ ...reading, criterion: null })).toBe(
      '/estudiante/tutor?course_id=5&topic=Pendiente+y+cambio',
    )
  })

  it('interpreta la búsqueda del tutor y valida curso y tema', () => {
    expect(tutorSeedFromSearch('course_id=5&topic=+Funciones+lineales+&criterion=a')).toEqual({
      course_id: 5,
      topic: 'Funciones lineales',
      criterion: 'A',
    })
    expect(tutorSeedFromSearch(new URLSearchParams({ course_id: '7', topic: 'Genética' }))).toEqual({
      course_id: 7,
      topic: 'Genética',
    })

    expect(tutorSeedFromSearch('course_id=abc&topic=Tema')).toBeNull()
    expect(tutorSeedFromSearch('course_id=0&topic=Tema')).toBeNull()
    expect(tutorSeedFromSearch('course_id=5&topic=%20%20')).toBeNull()
    expect(tutorSeedFromSearch('')).toBeNull()
  })
})
