import { useMemo, useState } from 'react'
import { fetchCourseRoster, fetchTeacherCourses } from '../../../api/teacher'
import { useApi } from '../../../hooks/useApi'
import { useLoadErrorToast } from '../../admin/shared/hooks'

export const RISK_LEVELS = {
  CRITICO: { badge: 'critico', label: 'Crítico', rank: 4 },
  ALTO: { badge: 'alto', label: 'Alto', rank: 3 },
  MEDIO: { badge: 'medio', label: 'Medio', rank: 2 },
  BAJO: { badge: 'normal', label: 'Bajo', rank: 1 },
}

export const isMissingEndpoint = (error) => error?.status === 404

export const studentName = (student) => `${student.last_name}, ${student.first_name}`

/** Fecha local (YYYY-MM-DD). `toISOString()` adelanta el día en UTC−5. */
export const localDate = (date = new Date()) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

export const ATTENDANCE_STATUS = {
  present: { label: 'Presente', badge: 'present' },
  late: { label: 'Tardanza', badge: 'late' },
  absent_justified: { label: 'Falta justificada', badge: 'absent_justified' },
  absent_unjustified: { label: 'Falta injustificada', badge: 'absent_unjustified' },
}

export const normalizeAttendanceStatus = (status) => {
  if (status === 'justified') return 'absent_justified'
  if (status === 'absent') return 'absent_unjustified'
  return ATTENDANCE_STATUS[status] ? status : null
}

export const formatPct = (value) => (value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`)
export const formatNumber = (value, digits = 1) =>
  value === null || value === undefined ? '—' : Number(value).toFixed(digits)

/** Cursos del docente y sus aulas (sin duplicados). `classroomId` por defecto es la primera aula. */
export function useTeacherScope() {
  const query = useApi(({ signal }) => fetchTeacherCourses({ signal }), [])
  useLoadErrorToast(query.error)
  const [selected, setSelected] = useState(null)

  const courses = useMemo(() => query.data?.data ?? [], [query.data])
  const classrooms = useMemo(() => {
    const byId = new Map()
    courses.forEach((course) => {
      if (course.classroom?.id && !byId.has(course.classroom.id)) byId.set(course.classroom.id, course.classroom)
    })
    return [...byId.values()]
  }, [courses])

  return {
    ...query,
    courses,
    classrooms,
    classroomId: selected ?? classrooms[0]?.id ?? null,
    setClassroomId: setSelected,
  }
}

/** Estudiantes del aula: unión de las matrículas activas de los cursos del docente en esa aula. */
export function useClassroomRoster(classroomId, courses) {
  const courseIds = courses.filter((course) => course.classroom?.id === classroomId).map((course) => course.id)
  const query = useApi(
    async ({ signal }) => {
      if (!courseIds.length) return []
      const lists = await Promise.all(courseIds.map((id) => fetchCourseRoster(id, { signal })))
      const byId = new Map(lists.flat().map((student) => [student.student_id, student]))
      return [...byId.values()].sort((a, b) => studentName(a).localeCompare(studentName(b)))
    },
    [classroomId, courseIds.join(',')],
  )
  useLoadErrorToast(query.error)
  return query
}

export function downloadBlob({ blob, filename }, fallbackName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename ?? fallbackName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
