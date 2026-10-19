import { apiRequest } from './client.js'
import { withQuery } from './query.js'

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

export const fetchAuditLogs = (params, options) => apiRequest(withQuery('/admin/audit-logs', params), options)
