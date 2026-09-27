import { apiRequest } from './client.js'

export { createFollowUp, createIntervention, fetchAlerts, updateAlert } from './teacher.js'

const withQuery = (path, params = {}) => {
  const entries = Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  return entries.length ? `${path}?${new URLSearchParams(entries)}` : path
}

/** Internos activos: `{ id, student_code, name, classroom, presence? }`; `presence` solo si se envía `presence_date`. */
export const fetchResidents = (params, options) => apiRequest(withQuery('/residents', params), options)

export const fetchPresences = (params, options) => apiRequest(withQuery('/presences', params), options)
export const updatePresence = (id, body) => apiRequest(`/presences/${id}`, { method: 'PUT', body })
/** `{ presence_date, check_type, records: [{ student_id, status, notes }] }`: crea o actualiza, todo o nada. */
export const savePresencesBulk = (body) => apiRequest('/presences/bulk', { method: 'POST', body })

export const fetchIncidents = (params, options) => apiRequest(withQuery('/incidents', params), options)
export const saveIncident = (id, body) =>
  apiRequest(id ? `/incidents/${id}` : '/incidents', { method: id ? 'PUT' : 'POST', body })

export const fetchPermissions = (params, options) => apiRequest(withQuery('/permissions', params), options)
export const resolvePermission = (id, decision) =>
  apiRequest(`/permissions/${id}/resolve`, { method: 'PATCH', body: { decision } })
