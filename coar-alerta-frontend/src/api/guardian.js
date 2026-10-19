import { apiRequest } from './client.js'
import { withQuery } from './query.js'

/** Requiere `student_id` del hijo vinculado. */
export const fetchChildSummary = (studentId, options) =>
  apiRequest(withQuery('/me/summary', { student_id: studentId }), options)

export const fetchGuardianPermissions = (params, options) => apiRequest(withQuery('/permissions', params), options)

/** `{ decision: 'approved' | 'rejected' }`. */
export const respondPermissionAsGuardian = (id, decision) =>
  apiRequest(`/permissions/${id}/guardian`, { method: 'PATCH', body: { decision } })

/** Solo conducta/convivencia; el backend omite descripción y salud/emocional. */
export const fetchGuardianIncidents = (params, options) => apiRequest(withQuery('/incidents', params), options)
