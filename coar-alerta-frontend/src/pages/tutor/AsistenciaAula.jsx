import { useEffect, useMemo, useState } from 'react'
import AlertBadge from '../../components/AlertBadge'
import DataTable from '../../components/DataTable'
import { fetchAttendanceSession, fetchCourses, saveAttendanceSession } from '../../api/attendance'

const STATUS_OPTIONS = [
  { value: 'present', label: 'Presente' },
  { value: 'absent', label: 'Falta' },
  { value: 'late', label: 'Tardanza' },
  { value: 'justified', label: 'Justificado' },
]

const today = () => new Date().toISOString().slice(0, 10)

export default function AsistenciaAula() {
  const [courses, setCourses] = useState([])
  const [courseId, setCourseId] = useState('')
  const [attendanceDate, setAttendanceDate] = useState(today())
  const [students, setStudents] = useState([])
  const [classroomName, setClassroomName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    fetchCourses()
      .then((payload) => {
        if (!active) return
        const list = payload.data ?? []
        setCourses(list)
        if (list[0]) setCourseId(String(list[0].id))
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!courseId || !attendanceDate) return undefined
    let active = true
    setError('')
    setSuccess('')
    fetchAttendanceSession(courseId, attendanceDate)
      .then((payload) => {
        if (!active) return
        setClassroomName(payload.data.classroom?.name ?? '')
        setStudents(
          (payload.data.students ?? []).map((student) => ({
            ...student,
            id: student.student_id,
            status: student.status ?? 'present',
            notes: student.notes ?? '',
          })),
        )
      })
      .catch((err) => {
        if (active) {
          setStudents([])
          setError(err.message)
        }
      })
    return () => {
      active = false
    }
  }, [courseId, attendanceDate])

  const selectedCourse = useMemo(
    () => courses.find((course) => String(course.id) === String(courseId)),
    [courses, courseId],
  )

  const updateStudent = (studentId, patch) => {
    setStudents((current) =>
      current.map((student) => (student.student_id === studentId ? { ...student, ...patch } : student)),
    )
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!courseId || students.length === 0) {
      setError('Selecciona un aula/curso con estudiantes matriculados.')
      return
    }
    setSaving(true)
    try {
      await saveAttendanceSession({
        course_id: Number(courseId),
        attendance_date: attendanceDate,
        records: students.map((student) => ({
          student_id: student.student_id,
          status: student.status,
          notes: student.notes || null,
        })),
      })
      setSuccess(`Asistencia de ${students.length} estudiantes guardada en ${selectedCourse?.name ?? 'el curso'}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-navy-950">Asistencia de aula</h1>
        <p className="text-sm text-slate-500">
          PO01: el registro se valida y persiste en Laravel/MySQL. No se guarda solo en el navegador.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" data-cy="attendance-form">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Aula / curso
            <select
              data-cy="course-select"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-teal-500 focus:ring-2"
              required
            >
              {courses.length === 0 ? <option value="">Sin cursos asignados</option> : null}
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.classroom?.name} · {course.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Fecha de sesión
            <input
              data-cy="attendance-date"
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-teal-500 focus:ring-2"
              required
            />
          </label>
          <div className="flex items-end">
            <p className="text-sm text-slate-500">
              {classroomName ? `Aula ${classroomName}` : 'Selecciona un curso'} · {students.length} estudiantes
            </p>
          </div>
        </div>

        {error ? (
          <p data-cy="attendance-error" className="text-sm text-rose-600">
            {error}
          </p>
        ) : null}
        {success ? (
          <p data-cy="attendance-success" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </p>
        ) : null}

        {loading ? <p className="text-sm text-slate-500">Cargando cursos…</p> : null}

        <DataTable
          columns={[
            {
              key: 'student',
              header: 'Estudiante',
              render: (row) => `${row.last_name}, ${row.first_name}`,
            },
            { key: 'student_code', header: 'Código' },
            {
              key: 'status',
              header: 'Estado',
              render: (row) => (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={row.status}
                    onChange={(e) => updateStudent(row.student_id, { status: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <AlertBadge nivel={row.status} />
                </div>
              ),
            },
            {
              key: 'notes',
              header: 'Observación',
              render: (row) => (
                <input
                  value={row.notes}
                  onChange={(e) => updateStudent(row.student_id, { notes: e.target.value })}
                  className="w-full min-w-[140px] rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  maxLength={500}
                />
              ),
            },
          ]}
          rows={students}
        />

        <button
          type="submit"
          disabled={saving || students.length === 0}
          data-cy="save-attendance"
          className="rounded-xl bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Registrar asistencia'}
        </button>
      </form>
    </div>
  )
}
