import { useState } from 'react'
import { CheckCheck, ClipboardCheck, Save, Users } from 'lucide-react'
import { fetchAttendanceSession, saveAttendanceSession } from '../../api/teacher'
import AlertBadge from '../../components/AlertBadge'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import { SkeletonList } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { useApi, useMutation } from '../../hooks/useApi'
import { notifyError, useLoadErrorToast } from '../admin/shared/hooks'
import { FilterBar, LoadError, primaryButton, secondaryButton } from '../admin/shared/ui'
import {
  ATTENDANCE_STATUS,
  localDate,
  normalizeAttendanceStatus,
  studentName,
  useTeacherScope,
} from './shared/hooks'

const STATUS_TONES = {
  present: 'border-teal-600 bg-teal-600 text-white',
  late: 'border-amber-500 bg-amber-500 text-white',
  absent_justified: 'border-sky-600 bg-sky-600 text-white',
  absent_unjustified: 'border-rose-600 bg-rose-600 text-white',
}

const courseLabel = (course) => `${course.classroom?.name ? `${course.classroom.name} · ` : ''}${course.name}`

/** `records.3.notes` → { [studentId]: { notes: 'mensaje' } } según el orden enviado. */
function rowErrorsFrom(fieldErrors, studentIds) {
  const byStudent = {}
  Object.entries(fieldErrors).forEach(([key, message]) => {
    const match = key.match(/^records\.(\d+)\.(\w+)$/)
    const studentId = match ? studentIds[Number(match[1])] : null
    if (studentId) byStudent[studentId] = { ...byStudent[studentId], [match[2]]: message }
  })
  return byStudent
}

function StudentRow({ student, value, dirty, errors = {}, onChange }) {
  const saved = normalizeAttendanceStatus(student.status)
  const showNotes = value.status !== 'present' || value.notes

  return (
    <li className={`rounded-2xl border bg-white p-4 shadow-sm ${dirty ? 'border-amber-300' : 'border-slate-200'}`} data-cy="attendance-row">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-navy-950">{studentName(student)}</p>
            <p className="text-xs text-slate-500">
              {student.student_code}
              {dirty ? ' · sin guardar' : saved ? ' · registrado' : ' · pendiente'}
            </p>
          </div>
          <AlertBadge nivel={value.status} />
        </div>
        <div role="radiogroup" aria-label={`Asistencia de ${studentName(student)}`} className="grid grid-cols-2 gap-2">
          {Object.entries(ATTENDANCE_STATUS).map(([status, meta]) => (
            <button
              key={status}
              type="button"
              role="radio"
              aria-checked={value.status === status}
              onClick={() => onChange({ status })}
              className={`h-10 rounded-xl border px-3 text-sm font-medium ${
                value.status === status ? STATUS_TONES[status] : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </div>
      {errors.status || errors.student_id ? <p className="mt-2 text-xs text-rose-600">{errors.status ?? errors.student_id}</p> : null}
      {showNotes ? (
        <Field
          className="mt-3"
          label="Observación"
          name={`notes-${student.student_id}`}
          maxLength={500}
          value={value.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          error={errors.notes}
        />
      ) : null}
    </li>
  )
}

function SessionSheet({ courseId, date, onFieldErrors }) {
  const toast = useToast()
  const [drafts, setDrafts] = useState({})
  const [rowErrors, setRowErrors] = useState({})
  const query = useApi(
    ({ signal }) => fetchAttendanceSession(courseId, date, { signal }),
    [courseId, date],
  )
  useLoadErrorToast(query.error)
  const save = useMutation(saveAttendanceSession, { onError: (error) => notifyError(toast, error, { form: true }) })

  const students = query.data?.data?.students ?? []
  const classroomName = query.data?.data?.classroom?.name
  const valueOf = (student) =>
    drafts[student.student_id] ?? {
      status: normalizeAttendanceStatus(student.status) ?? 'present',
      notes: student.notes ?? '',
    }

  const change = (student, patch) => {
    setDrafts((current) => ({
      ...current,
      [student.student_id]: { ...valueOf(student), ...current[student.student_id], ...patch },
    }))
    setRowErrors((current) => ({ ...current, [student.student_id]: undefined }))
  }

  const markPendingPresent = () => {
    const unmarked = students.filter((student) => !normalizeAttendanceStatus(student.status) && !drafts[student.student_id]?.status)
    if (!unmarked.length) return toast.info('Todos los estudiantes de esta sesión ya tienen estado.')
    setDrafts((current) => ({
      ...current,
      ...Object.fromEntries(unmarked.map((student) => [student.student_id, { status: 'present', notes: '' }])),
    }))
  }

  const submit = async () => {
    if (!students.length) return toast.warning('No hay estudiantes matriculados en este curso.')
    const records = students.map((student) => {
      const value = valueOf(student)
      return { student_id: student.student_id, status: value.status, notes: value.notes?.trim() || null }
    })
    const result = await save.mutate({ course_id: Number(courseId), attendance_date: date, records })
    if (result.ok) {
      toast.success(`Asistencia de ${records.length} estudiantes guardada.`)
      setDrafts({})
      setRowErrors({})
      onFieldErrors({})
      query.reload()
    } else {
      const fieldErrors = result.error?.fieldErrors ?? {}
      setRowErrors(rowErrorsFrom(fieldErrors, records.map((record) => record.student_id)))
      onFieldErrors(fieldErrors)
    }
  }

  let body
  if (query.error && !query.data) body = <LoadError onRetry={query.reload} />
  else if (query.loading && !query.data) body = <SkeletonList rows={5} />
  else if (!students.length) {
    body = (
      <EmptyState
        icon={ClipboardCheck}
        title="No hay estudiantes matriculados en este curso."
        description="Pide a administración que registre las matrículas del periodo vigente."
      />
    )
  } else {
    body = (
      <ul className="space-y-3">
        {students.map((student) => (
          <StudentRow
            key={student.student_id}
            student={student}
            value={valueOf(student)}
            dirty={Boolean(drafts[student.student_id])}
            errors={rowErrors[student.student_id]}
            onChange={(patch) => change(student, patch)}
          />
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          {classroomName ? `Aula ${classroomName}` : 'Curso'} · {students.length} estudiantes · estados IB: presente, tardanza, falta justificada e injustificada.
        </p>
        <button type="button" className={secondaryButton} onClick={markPendingPresent} disabled={!students.length}>
          <CheckCheck size={16} />
          Pendientes como presentes
        </button>
      </div>

      {body}

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
          <p className="text-sm text-slate-600" data-cy={save.data ? 'attendance-success' : undefined}>
            {Object.keys(drafts).length ? `${Object.keys(drafts).length} cambio(s) sin guardar` : 'Se registrará la sesión completa'}
          </p>
          <button
            type="button"
            className={primaryButton}
            disabled={save.loading || !students.length}
            onClick={submit}
            data-cy="save-attendance"
          >
            <Save size={16} />
            {save.loading ? 'Guardando…' : 'Registrar asistencia'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AsistenciaAula() {
  const scope = useTeacherScope()
  const [courseId, setCourseId] = useState(null)
  const [date, setDate] = useState(localDate())
  const [errors, setErrors] = useState({})
  const selected = courseId ?? scope.courses[0]?.id ?? null

  return (
    <div className="space-y-4" data-cy="attendance-form">
      <div>
        <h1 className="font-display text-3xl text-navy-950">Asistencia de aula</h1>
        <p className="text-sm text-slate-500">Registro masivo por clase. Cada cambio queda auditado en el servidor; no se guarda solo en el navegador.</p>
      </div>

      {scope.error && !scope.data ? (
        <LoadError onRetry={scope.reload} />
      ) : !scope.loading && scope.courses.length === 0 ? (
        <EmptyState icon={Users} title="No tienes cursos asignados." description="Pide a administración que te asigne cursos del periodo vigente." />
      ) : (
        <>
          <FilterBar>
            <Field
              as="select"
              label="Curso"
              name="course_id"
              value={selected ?? ''}
              onChange={(e) => setCourseId(Number(e.target.value) || null)}
              disabled={scope.loading}
              error={errors.course_id}
              required
              data-cy="course-select"
            >
              {scope.loading ? <option value="">Cargando…</option> : null}
              {scope.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {courseLabel(course)}
                </option>
              ))}
            </Field>
            <Field
              label="Fecha de sesión"
              name="attendance_date"
              type="date"
              max={localDate()}
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              error={errors.attendance_date}
              required
              data-cy="attendance-date"
            />
          </FilterBar>
          {selected ? (
            <SessionSheet key={`${selected}|${date}`} courseId={selected} date={date} onFieldErrors={setErrors} />
          ) : (
            <SkeletonList rows={4} />
          )}
        </>
      )}
    </div>
  )
}
