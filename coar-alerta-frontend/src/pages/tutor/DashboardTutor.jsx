import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, Download, ShieldAlert, UserSearch, Users } from 'lucide-react'
import { exportClassroomReport, fetchStudentRisk } from '../../api/teacher'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Skeleton, { SkeletonList } from '../../components/Skeleton'
import StatCard from '../../components/StatCard'
import { useToast } from '../../components/Toast'
import { useApi, useMutation } from '../../hooks/useApi'
import { notifyError } from '../admin/shared/hooks'
import { FilterBar, LoadError, secondaryButton } from '../admin/shared/ui'
import { RISK_LEVELS, downloadBlob, formatNumber, formatPct, studentName, useClassroomRoster, useTeacherScope } from './shared/hooks'
import { ClassroomPicker, RiskBadge } from './shared/ui'

const FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'ALTO', label: 'Riesgo alto' },
  { value: 'MEDIO', label: 'Riesgo medio' },
  { value: 'BAJO', label: 'Riesgo bajo' },
  { value: 'none', label: 'Sin datos suficientes' },
]

const hasData = (risk) => Boolean(risk && !risk.insufficient_data && risk.risk_level)
const rank = (risk) => (hasData(risk) ? (RISK_LEVELS[risk.risk_level]?.rank ?? 0) : 0)

function RiskCard({ student, risk }) {
  const factors = [...(risk?.factors ?? [])].sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0)).slice(0, 3)

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-cy="risk-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy-950">{studentName(student)}</p>
          <p className="text-xs text-slate-500">
            {student.student_code}
            {hasData(risk) ? ` · puntaje ${formatNumber(risk.risk_score)} · cobertura ${formatPct(risk.data_coverage)}` : ''}
          </p>
        </div>
        <RiskBadge level={hasData(risk) ? risk.risk_level : null} />
      </div>

      {risk?.needs_human_review ? (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">Requiere revisión humana prioritaria.</p>
      ) : null}

      {hasData(risk) && factors.length ? (
        <ul className="mt-3 space-y-1.5">
          {factors.map((factor) => (
            <li key={factor.key} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
              <span className="text-navy-900">{factor.label}</span>
              <span className="shrink-0 text-xs text-slate-500">+{formatNumber(factor.contribution)} pts</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 text-sm text-slate-600">
        {risk?.recommendation ??
          (risk?.insufficient_data ? 'Aún no hay suficientes registros de asistencia o notas.' : 'Sin evaluación de riesgo todavía.')}
      </p>
    </article>
  )
}

function DownloadReportButton({ classroomId }) {
  const toast = useToast()
  const mutation = useMutation(() => exportClassroomReport(classroomId, 'pdf'), {
    onSuccess: (file) => {
      downloadBlob(file, `reporte-aula-${classroomId}.pdf`)
      toast.success('Reporte descargado.')
    },
    onError: (error) => notifyError(toast, error),
  })

  return (
    <button
      type="button"
      className={secondaryButton}
      data-cy="download-report"
      disabled={!classroomId || mutation.loading}
      onClick={() => mutation.mutate()}
    >
      <Download size={16} />
      {mutation.loading ? 'Generando…' : 'Descargar Reporte'}
    </button>
  )
}

export default function DashboardTutor() {
  const scope = useTeacherScope()
  const roster = useClassroomRoster(scope.classroomId, scope.courses)
  const [filter, setFilter] = useState('')

  const risks = useApi(
    async ({ signal }) => {
      if (!roster.data) return null
      return Promise.all(
        roster.data.map((student) =>
          fetchStudentRisk(student.student_id, { signal })
            .then((payload) => ({
              student,
              risk: payload.available ? payload.data : null,
              available: Boolean(payload.available),
            }))
            .catch((error) => {
              if (error.kind === 'aborted') throw error
              return { student, risk: null, available: false }
            }),
        ),
      )
    },
    [roster.data],
  )

  const rows = useMemo(
    () =>
      [...(risks.data ?? [])].sort(
        (a, b) => rank(b.risk) - rank(a.risk) || (b.risk?.risk_score ?? -1) - (a.risk?.risk_score ?? -1),
      ),
    [risks.data],
  )
  const count = (level) => rows.filter((row) => hasData(row.risk) && row.risk.risk_level === level).length
  const visible = rows.filter((row) =>
    !filter ? true : filter === 'none' ? !hasData(row.risk) : hasData(row.risk) && row.risk.risk_level === filter,
  )
  const loading = scope.loading || roster.loading || risks.loading
  const analyticsDown = rows.length > 0 && rows.every((row) => row.available === false)

  const header = (
    <div>
      <h1 className="font-display text-3xl text-navy-950">Riesgo del aula</h1>
      <p className="text-sm text-slate-500">
        Puntaje explicable por estudiante (asistencia, notas IB, incidencias y presencia). Es una señal para priorizar tutoría, no un diagnóstico.
      </p>
    </div>
  )

  if (scope.error && !scope.data) {
    return (
      <div className="space-y-6" data-cy="dashboard-tutor">
        {header}
        <LoadError onRetry={scope.reload} />
      </div>
    )
  }

  if (!scope.loading && scope.classrooms.length === 0) {
    return (
      <div className="space-y-6" data-cy="dashboard-tutor">
        {header}
        <EmptyState icon={Users} title="No tienes aulas asignadas." description="Pide a administración que te asigne cursos del periodo vigente." />
      </div>
    )
  }

  return (
    <div className="space-y-6" data-cy="dashboard-tutor">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {header}
        <DownloadReportButton classroomId={scope.classroomId} />
      </div>

      <FilterBar>
        <ClassroomPicker scope={scope} />
        <Field as="select" label="Mostrar" name="risk_filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Field>
      </FilterBar>

      {analyticsDown ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          El motor analítico no devolvió predicciones. Se muestra el aula; el puntaje se actualizará cuando el cálculo nocturno o bajo demanda esté disponible.
        </p>
      ) : null}

      {loading && !risks.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={ShieldAlert} label="Riesgo alto" value={count('ALTO')} hint="Priorizar entrevista esta semana" tone="rose" />
          <StatCard icon={Brain} label="Riesgo medio" value={count('MEDIO')} hint="Monitoreo preventivo" tone="amber" />
          <StatCard
            icon={UserSearch}
            label="Revisión humana"
            value={rows.filter((row) => row.risk?.needs_human_review).length}
            hint="Incidencias graves de salud o emocionales"
            tone="navy"
          />
          <StatCard
            icon={Users}
            label="Estudiantes"
            value={rows.length}
            hint={`${rows.filter((row) => !hasData(row.risk)).length} sin datos suficientes`}
            tone="slate"
          />
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-navy-950">Estudiantes</h2>
          <Link to="/tutor/alertas" className="text-sm font-medium text-teal-700 hover:text-teal-900">
            Ver alertas e intervenciones →
          </Link>
        </div>
        {loading ? (
          <SkeletonList rows={4} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={rows.length ? 'Ningún estudiante coincide con el filtro.' : 'No hay estudiantes matriculados en esta aula.'}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map(({ student, risk }) => (
              <RiskCard key={student.student_id} student={student} risk={risk} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
