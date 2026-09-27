import { useState } from 'react'
import { fetchChildSummary } from '../../api/guardian'
import { STORAGE_PREFIX } from '../../api/client'
import Field from '../../components/Field'
import { useAuth } from '../../context/AuthContext'
import { useApi } from '../../hooks/useApi'
import { useLoadErrorToast } from '../admin/shared/hooks'

const SELECTED_STUDENT_KEY = `${STORAGE_PREFIX}guardian.studentId`
const EMPTY_STUDENTS = []

export const PASSING_SCORE = 4

export const ATTENDANCE_STATUS = {
  present: { label: 'Presente' },
  late: { label: 'Tardanza' },
  absent_justified: { label: 'Falta justificada' },
  justified: { label: 'Falta justificada' },
  absent_unjustified: { label: 'Falta injustificada' },
  absent: { label: 'Falta injustificada' },
}

export const RESIDENCE_STATUS = {
  present: { label: 'Presente' },
  absent: { label: 'Ausente' },
  on_permission: { label: 'Con permiso' },
}

export const INCIDENT_CATEGORIES = [
  { value: 'conducta', label: 'Conducta' },
  { value: 'convivencia', label: 'Convivencia' },
]

export const formatScore = (value) => (value === null || value === undefined ? '—' : Number(value).toFixed(1))
export const formatRate = (rate) => (rate === null || rate === undefined ? '—' : `${Math.round(rate * 1000) / 10}%`)

const readStoredStudentId = (students) => {
  const stored = Number(sessionStorage.getItem(SELECTED_STUDENT_KEY))
  return students.some((student) => student.id === stored) ? stored : (students[0]?.id ?? null)
}

/** Hijos vinculados de `/auth/me`. Persiste la selección entre pantallas. */
export function useLinkedStudent() {
  const { user } = useAuth()
  const students = user?.students ?? EMPTY_STUDENTS
  const [pickedId, setPickedId] = useState(null)
  const studentId = students.some((student) => student.id === pickedId) ? pickedId : readStoredStudentId(students)

  const select = (id) => {
    setPickedId(id)
    if (id) sessionStorage.setItem(SELECTED_STUDENT_KEY, String(id))
    else sessionStorage.removeItem(SELECTED_STUDENT_KEY)
  }

  return {
    students,
    studentId,
    student: students.find((item) => item.id === studentId) ?? null,
    setStudentId: select,
  }
}

export function StudentPicker({ students, studentId, onChange, className = '' }) {
  if (students.length <= 1) return null

  return (
    <Field
      as="select"
      label="Hijo/a"
      name="student_id"
      className={className}
      value={studentId ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      {students.map((student) => (
        <option key={student.id} value={student.id}>
          {student.name}
          {student.classroom ? ` · ${student.classroom}` : ''}
        </option>
      ))}
    </Field>
  )
}

export function useChildSummary(studentId) {
  const query = useApi(
    ({ signal }) => (studentId ? fetchChildSummary(studentId, { signal }) : Promise.resolve(null)),
    [studentId],
  )
  useLoadErrorToast(query.error)
  return { ...query, summary: query.data?.data ?? null }
}
