import { BarChart3, ClipboardCheck, Download, GraduationCap, ShieldAlert, Users } from 'lucide-react'
import { exportClassroomReport, fetchClassroomAnalytics } from '../../api/teacher'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Skeleton from '../../components/Skeleton'
import StatCard from '../../components/StatCard'
import { useToast } from '../../components/Toast'
import { useApi, useMutation } from '../../hooks/useApi'
import { notifyError, useLoadErrorToast } from '../admin/shared/hooks'
import { FilterBar, LoadError, secondaryButton } from '../admin/shared/ui'
import { downloadBlob, formatNumber, formatPct, isMissingEndpoint, useTeacherScope } from './shared/hooks'
import { ClassroomPicker, RiskBadge } from './shared/ui'

function ExportButton({ classroomId, format, label }) {
  const toast = useToast()
  const mutation = useMutation(() => exportClassroomReport(classroomId, format), {
    onSuccess: (file) => {
      downloadBlob(file, `reporte-aula-${classroomId}.${format}`)
      toast.success(`Reporte ${label} descargado.`)
    },
    onError: (error) =>
      isMissingEndpoint(error) ? toast.warning('La exportación aún no está disponible en el servidor.') : notifyError(toast, error),
  })

  return (
    <button type="button" className={secondaryButton} disabled={!classroomId || mutation.loading} onClick={() => mutation.mutate()}>
      <Download size={16} />
      {mutation.loading ? 'Generando…' : `Descargar ${label}`}
    </button>
  )
}

export default function ReporteGrupo() {
  const scope = useTeacherScope()
  const classroomId = scope.classroomId
  const report = useApi(
    ({ signal }) => (classroomId ? fetchClassroomAnalytics(classroomId, { signal }) : Promise.resolve(null)),
    [classroomId],
  )
  useLoadErrorToast(isMissingEndpoint(report.error) ? null : report.error)
  const data = report.data?.data
  const summary = data?.summary ?? {}
  const distribution = data?.risk_distribution ?? {}

  let body
  if (scope.error && !scope.data) body = <LoadError onRetry={scope.reload} />
  else if (!scope.loading && !classroomId) body = <EmptyState icon={Users} title="No tienes aulas asignadas." />
  else if (scope.loading || (report.loading && !data)) {
    body = (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    )
  } else if (isMissingEndpoint(report.error)) {
    body = (
      <EmptyState
        icon={BarChart3}
        title="El reporte de grupo aún no está disponible."
        description="El servidor todavía no publica la analítica de aulas. Vuelve a intentarlo más adelante."
      />
    )
  } else if (report.error) body = <LoadError onRetry={report.reload} />
  else if (!data || data.insufficient_data) {
    body = <EmptyState icon={BarChart3} title="Aún no hay datos suficientes para este grupo." description="Registra asistencia y notas para generar el reporte." />
  } else {
    body = (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} label="Estudiantes" value={summary.students ?? '—'} tone="slate" />
          <StatCard
            icon={GraduationCap}
            label="Promedio IB"
            value={formatNumber(summary.grade_mean)}
            hint={`${formatPct(summary.pass_rate)} con nota ≥ 4`}
            tone="navy"
          />
          <StatCard icon={ClipboardCheck} label="Asistencia" value={formatPct(summary.attendance_rate)} tone="teal" />
          <StatCard icon={ShieldAlert} label="Alertas abiertas" value={summary.open_alerts ?? 0} tone="rose" />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-navy-950">Distribución de riesgo</h2>
          <dl className="mt-4 grid gap-3 min-[480px]:grid-cols-3">
            {['ALTO', 'MEDIO', 'BAJO'].map((level) => (
              <div key={level} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <dt>
                  <RiskBadge level={level} />
                </dt>
                <dd className="text-2xl font-semibold text-navy-950">{distribution[level] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-navy-950">Por curso</h2>
          <DataTable
            keyField="course_id"
            rows={data.courses ?? []}
            empty="Sin cursos con datos."
            columns={[
              { key: 'course_name', header: 'Curso', primary: true },
              { key: 'grade_mean', header: 'Promedio IB', render: (row) => formatNumber(row.grade_mean) },
              { key: 'pass_rate', header: 'Aprobados (≥ 4)', render: (row) => formatPct(row.pass_rate) },
              { key: 'attendance_rate', header: 'Asistencia', render: (row) => formatPct(row.attendance_rate) },
            ]}
          />
        </section>
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-navy-950">Reporte de grupo</h1>
          <p className="text-sm text-slate-500">Rendimiento, asistencia y riesgo del aula. Descárgalo para reuniones de tutoría.</p>
        </div>
        <div className="flex flex-col gap-2 min-[480px]:flex-row">
          <ExportButton classroomId={classroomId} format="pdf" label="PDF" />
          <ExportButton classroomId={classroomId} format="csv" label="CSV" />
        </div>
      </div>

      <FilterBar>
        <ClassroomPicker scope={scope} />
      </FilterBar>

      {body}
    </div>
  )
}
