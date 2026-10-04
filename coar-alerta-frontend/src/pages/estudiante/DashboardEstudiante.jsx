import { BellRing, BookOpen, ClipboardCheck, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchMyAlerts } from '../../api/student'
import EmptyState from '../../components/EmptyState'
import Pagination from '../../components/Pagination'
import Skeleton from '../../components/Skeleton'
import StatCard from '../../components/StatCard'
import { usePagedList } from '../admin/shared/hooks'
import { LoadError, linkButton } from '../admin/shared/ui'
import { StatusBadge, formatDateTime } from '../residencia/shared'
import { RiskBadge } from '../tutor/shared/ui'
import ScoreBadge from './ScoreBadge'
import { ALERT_STATUS, ATTENDANCE_STATUS, alertText, formatRate, formatScore, useMyRisk, useMySummary } from './shared'

function Panel({ title, to, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-navy-950">{title}</h2>
        {to ? (
          <Link to={to} className={linkButton}>
            Ver detalle
          </Link>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function DashboardEstudiante() {
  const { summary, loading, error, reload } = useMySummary()
  const { risk, available: riskAvailable, loading: riskLoading } = useMyRisk(summary?.student?.id)
  const alerts = usePagedList(fetchMyAlerts)

  const header = (
    <div>
      <h1 className="font-display text-3xl text-navy-950">Mi resumen</h1>
      <p className="text-sm text-slate-500">
        {summary
          ? [summary.student?.name, summary.student?.classroom, summary.academic_period?.name].filter(Boolean).join(' · ')
          : 'Promedios, asistencia e historial de alertas del periodo vigente.'}
      </p>
    </div>
  )

  if (loading && !summary) {
    return (
      <div className="space-y-6" data-cy="dashboard-estudiante">
        {header}
        <div className="grid gap-4 min-[480px]:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="space-y-6" data-cy="dashboard-estudiante">
        {header}
        <LoadError onRetry={reload} />
      </div>
    )
  }

  const { grades, attendance, alerts: alertSummary = { open: 0 } } = summary
  const byStatus = Object.entries(attendance?.by_status ?? {}).filter(([, total]) => total > 0)

  return (
    <div className="space-y-6" data-cy="dashboard-estudiante">
      {header}
      <div className="grid gap-4 min-[480px]:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={BookOpen}
          label="Promedio general IB"
          value={formatScore(grades?.average)}
          hint={
            grades?.average === null || grades?.average === undefined
              ? 'Aún no tienes notas registradas'
              : `Escala 1–7 · ${grades.failing_courses} curso(s) por debajo de 4`
          }
          tone={grades?.average != null && grades.average < 4 ? 'rose' : 'navy'}
        />
        <StatCard
          icon={ClipboardCheck}
          label="Asistencia"
          value={formatRate(attendance?.rate)}
          hint={attendance?.total ? `${attendance.total} registros de clase` : 'Sin registros de asistencia'}
          tone="teal"
        />
        <StatCard
          icon={BellRing}
          label="Alertas activas"
          value={alertSummary.open ?? 0}
          hint={alertSummary.open ? 'Tu tutor ya está al tanto' : 'Sin alertas abiertas'}
          tone={alertSummary.open ? 'amber' : 'slate'}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" data-cy="mi-riesgo">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-navy-950">Mi nivel de riesgo</h2>
            <p className="text-sm text-slate-500">Solo ves el nivel y la recomendación. Es una señal para priorizar apoyo, no un diagnóstico.</p>
          </div>
          {riskLoading && !risk ? <Skeleton className="h-8 w-24 rounded-full" /> : <RiskBadge level={risk?.risk_level} />}
        </div>
        {riskLoading && !risk ? (
          <Skeleton className="mt-4 h-16 rounded-xl" />
        ) : (
          <p className="mt-4 text-sm text-slate-700">
            {risk?.recommendation ??
              (riskAvailable ? 'Sin recomendación registrada.' : 'Tu evaluación de riesgo aún no está disponible.')}
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Promedio por curso" to="/estudiante/calificaciones">
          {grades?.by_course?.length ? (
            <ul className="divide-y divide-slate-100">
              {grades.by_course.map((course) => (
                <li key={course.course_id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-950">{course.course_name}</p>
                    <p className="text-xs text-slate-500">{course.count} evaluación(es)</p>
                  </div>
                  <ScoreBadge value={course.average} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={BookOpen} title="Aún no hay notas en este periodo." />
          )}
        </Panel>

        <Panel title="Historial de alertas">
          {alerts.error && !alerts.data ? (
            <LoadError onRetry={alerts.reload} />
          ) : alerts.loading && !alerts.data ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : alerts.rows.length ? (
            <>
              <ul className="divide-y divide-slate-100">
                {alerts.rows.map((alert) => (
                  <li key={alert.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium text-navy-950">{alertText(alert)}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(alert.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <RiskBadge level={alert.severity} />
                      <StatusBadge map={ALERT_STATUS} value={alert.status} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <Pagination meta={alerts.meta} onPageChange={alerts.setPage} disabled={alerts.loading} />
              </div>
            </>
          ) : (
            <EmptyState icon={ShieldCheck} title="No tienes alertas registradas." description="Sigue así: asiste a clases y mantén tus notas." />
          )}
        </Panel>
      </div>

      {byStatus.length ? (
        <Panel title="Asistencia por estado" to="/estudiante/asistencia">
          <dl className="grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
            {byStatus.map(([status, total]) => (
              <div key={status} className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">{ATTENDANCE_STATUS[status]?.label ?? status}</dt>
                <dd className="mt-1 text-xl font-semibold text-navy-950">{total}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      ) : null}
    </div>
  )
}
