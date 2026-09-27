import { useState } from 'react'
import { createEnrollment, deleteEnrollment, importEnrollments } from '../../api/admin'
import ConfirmModal from '../../components/ConfirmModal'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import { useToast } from '../../components/Toast'
import { useMutation } from '../../hooks/useApi'
import { notifyError, useFormState } from './shared/hooks'
import { ClassroomSelect, CourseSelect, PeriodSelect, UserPicker, linkButton, primaryButton } from './shared/ui'

const cardClass = 'space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'

function IndividualEnrollment({ onEnrolled }) {
  const toast = useToast()
  const { form, set } = useFormState({ academic_period_id: null, classroom_id: null, course_id: null, student_id: null })
  const { mutate, loading, fieldErrors } = useMutation(createEnrollment, {
    onError: (error) => notifyError(toast, error, { form: true }),
  })

  const onSubmit = async (e) => {
    e.preventDefault()
    const result = await mutate({ student_id: form.student_id, course_id: form.course_id })
    if (!result.ok) return
    toast.success('Estudiante matriculado.')
    set('student_id', null)
    onEnrolled(result.data.data)
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cardClass}>
      <h2 className="font-semibold text-navy-950">Matrícula individual</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <PeriodSelect
          label="Periodo"
          name="enroll_period"
          value={form.academic_period_id}
          onChange={(value) => {
            set('academic_period_id', value)
            set('classroom_id', null)
            set('course_id', null)
          }}
        />
        <ClassroomSelect
          label="Aula"
          name="enroll_classroom"
          placeholder="Todas las aulas"
          periodId={form.academic_period_id}
          enabled={Boolean(form.academic_period_id)}
          value={form.classroom_id}
          onChange={(value) => {
            set('classroom_id', value)
            set('course_id', null)
          }}
        />
      </div>
      <CourseSelect
        label="Curso"
        name="course_id"
        periodId={form.academic_period_id}
        classroomId={form.classroom_id}
        value={form.course_id}
        onChange={(value) => set('course_id', value)}
        error={fieldErrors.course_id}
        required
      />
      <UserPicker
        label="Estudiante"
        name="student_id"
        role="student"
        value={form.student_id}
        onChange={(value) => set('student_id', value)}
        error={fieldErrors.student_id}
        required
      />
      <button type="submit" disabled={loading} className={`${primaryButton} w-full sm:w-auto`}>
        {loading ? 'Matriculando…' : 'Matricular'}
      </button>
    </form>
  )
}

function BulkEnrollment() {
  const toast = useToast()
  const [periodId, setPeriodId] = useState(null)
  const [file, setFile] = useState(null)
  const [fileKey, setFileKey] = useState(0)
  const { mutate, loading, error, fieldErrors, data } = useMutation(importEnrollments, {
    onError: (err) => notifyError(toast, err, { form: true }),
  })
  const rowErrors = Object.entries(error?.errors ?? {})
    .filter(([key]) => key.startsWith('rows.'))
    .flatMap(([key, messages]) => [].concat(messages).map((message) => `Fila ${Number(key.slice(5)) + 1}: ${message}`))
  const summary = data?.data

  const onSubmit = async (e) => {
    e.preventDefault()
    const result = await mutate({ file, academic_period_id: periodId ?? '' })
    if (!result.ok) return
    toast.success(result.data.message)
    setFile(null)
    setFileKey((k) => k + 1)
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cardClass}>
      <div>
        <h2 className="font-semibold text-navy-950">Matrícula masiva (CSV)</h2>
        <p className="mt-1 text-sm text-slate-500">
          Columnas obligatorias <code>student_code</code> y <code>course_code</code>. Si una fila falla, no se matricula ninguna.
        </p>
      </div>
      <PeriodSelect
        label="Periodo"
        name="academic_period_id"
        value={periodId}
        onChange={setPeriodId}
        error={fieldErrors.academic_period_id}
        required
      />
      <Field
        key={fileKey}
        label="Archivo CSV"
        name="file"
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        error={fieldErrors.file}
        hint="Máximo 2 MB."
        required
      />
      {rowErrors.length ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
          {rowErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      {summary ? (
        <dl className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-sm">
          {[
            ['Creadas', summary.created],
            ['Reactivadas', summary.reactivated],
            ['Omitidas', summary.skipped],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="text-lg font-semibold text-navy-950">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <button type="submit" disabled={loading} className={`${primaryButton} w-full sm:w-auto`}>
        {loading ? 'Procesando…' : 'Importar CSV'}
      </button>
    </form>
  )
}

export default function Matriculas() {
  const toast = useToast()
  const [recent, setRecent] = useState([])
  const [pending, setPending] = useState(null)
  const withdraw = useMutation((enrollment) => deleteEnrollment(enrollment.id), { onError: (error) => notifyError(toast, error) })

  const addRecent = (enrollment) => setRecent((current) => [enrollment, ...current.filter((item) => item.id !== enrollment.id)])

  const confirmWithdraw = async () => {
    const result = await withdraw.mutate(pending)
    setPending(null)
    if (!result.ok) return
    toast.success(result.data.message)
    setRecent((current) => current.map((item) => (item.id === result.data.data.id ? { ...item, ...result.data.data } : item)))
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-navy-950">Matrículas</h1>
        <p className="text-sm text-slate-500">Matricula estudiantes en cursos de forma individual o masiva.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <IndividualEnrollment onEnrolled={addRecent} />
        <BulkEnrollment />
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-navy-950">Registradas en esta sesión</h2>
        <DataTable
          rows={recent}
          empty={
            <EmptyState
              title="Aún no registras matrículas individuales."
              description="Las matrículas que registres aquí aparecerán en esta lista y podrás retirarlas."
            />
          }
          columns={[
            {
              key: 'student',
              header: 'Estudiante',
              primary: true,
              render: (row) => `${row.student?.last_name ?? ''}, ${row.student?.first_name ?? ''} (${row.student?.student_code ?? '—'})`,
            },
            { key: 'course', header: 'Curso', render: (row) => `${row.course?.code ?? ''} · ${row.course?.name ?? ''}` },
            { key: 'status', header: 'Estado', render: (row) => (row.status === 'active' ? 'Activa' : 'Retirada') },
            {
              key: 'actions',
              header: 'Acciones',
              render: (row) =>
                row.status === 'active' ? (
                  <button type="button" className={linkButton} onClick={() => setPending(row)}>
                    Retirar
                  </button>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      </section>

      <ConfirmModal
        open={Boolean(pending)}
        danger
        loading={withdraw.loading}
        title="Retirar matrícula"
        message={`Se retirará a ${pending?.student?.first_name ?? 'el estudiante'} de ${pending?.course?.name ?? 'el curso'}. Queda registrado en auditoría.`}
        confirmLabel="Retirar"
        onConfirm={confirmWithdraw}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
