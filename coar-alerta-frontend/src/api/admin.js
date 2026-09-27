import { apiRequest } from './client.js'

const withQuery = (path, params = {}) => {
  const entries = Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  return entries.length ? `${path}?${new URLSearchParams(entries)}` : path
}

const save = (resource) => (id, body) =>
  apiRequest(id ? `/admin/${resource}/${id}` : `/admin/${resource}`, { method: id ? 'PUT' : 'POST', body })

export const fetchAdminMetrics = (options) => apiRequest('/admin/metrics', options)

export const fetchUsers = (params, options) => apiRequest(withQuery('/admin/users', params), options)
export const saveUser = save('users')
export const toggleUserActive = (id) => apiRequest(`/admin/users/${id}/toggle-active`, { method: 'PATCH' })
export const resetUserPassword = (id) => apiRequest(`/admin/users/${id}/reset-password`, { method: 'POST' })

export const fetchClassrooms = (params, options) => apiRequest(withQuery('/admin/classrooms', params), options)
export const saveClassroom = save('classrooms')

export const fetchCourses = (params, options) => apiRequest(withQuery('/admin/courses', params), options)
export const saveCourse = save('courses')

export const fetchPeriods = (params, options) => apiRequest(withQuery('/admin/periods', params), options)
export const savePeriod = save('periods')
export const setCurrentPeriod = (id) => apiRequest(`/admin/periods/${id}/set-current`, { method: 'POST' })

export const createEnrollment = (body) => apiRequest('/admin/enrollments', { method: 'POST', body })
export const deleteEnrollment = (id) => apiRequest(`/admin/enrollments/${id}`, { method: 'DELETE' })
export function importEnrollments({ file, academic_period_id }) {
  const body = new FormData()
  body.append('file', file)
  body.append('academic_period_id', academic_period_id)
  return apiRequest('/admin/enrollments/bulk', { method: 'POST', body, timeout: 60000 })
}

export const fetchAuditLogs = (params, options) => apiRequest(withQuery('/admin/audit-logs', params), options)
