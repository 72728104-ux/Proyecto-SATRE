import { apiRequest } from './client.js'

export function fetchCourses() {
  return apiRequest('/courses')
}

export function fetchAttendanceSession(courseId, attendanceDate) {
  const query = new URLSearchParams({ attendance_date: attendanceDate })
  return apiRequest(`/courses/${courseId}/attendance-session?${query}`)
}

export function saveAttendanceSession(payload) {
  return apiRequest('/attendances/session', {
    method: 'POST',
    body: payload,
  })
}
