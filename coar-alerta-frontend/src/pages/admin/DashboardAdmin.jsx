import { ClipboardCheck, ShieldAlert, UserCheck, Users } from 'lucide-react'
import { fetchAdminMetrics } from '../../api/admin'
import Skeleton from '../../components/Skeleton'
import StatCard from '../../components/StatCard'
import { API_ROLE_TO_UI, ROLE_LABELS } from '../../data/roles'
import { useApi } from '../../hooks/useApi'
import { useLoadErrorToast } from './shared/hooks'
import { LoadError } from './shared/ui'

const SEVERITY_LABELS = { CRITICO: 'Crítica', ALTO: 'Alta', MEDIO: 'Media', BAJO: 'Baja' }

const breakdown = (entries, labels) =>
  Object.entries(entries ?? {})
    .map(([key, total]) => `${labels[key] ?? key}: ${total}`)
    .join(' · ')

export default function DashboardAdmin() {
  const { data, loading, error, reload } = useApi(({ signal }) => fetchAdminMetrics({ signal }), [])
  useLoadErrorToast(error)
  const m = data?.data

  const header = (
    <div>
      <h1 className="font-display text-3xl text-navy-950">Métricas institucionales</h1>
      <p className="text-sm text-slate-500">Usuarios activos, cobertura de asistencia y alertas abiertas.</p>
    </div>
  )

  if (loading && !m) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!m) {
    return (
      <div className="space-y-6">
        {header}
        <LoadError onRetry={reload} />
      </div>
    )
  }

  const { users, attendance_coverage: coverage, alerts } = m
  const roleLabels = Object.fromEntries(Object.entries(API_ROLE_TO_UI).map(([slug, ui]) => [slug, ROLE_LABELS[ui]]))

  return (
    <div className="space-y-6">
      {header}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Usuarios activos" value={users.active} hint={`${users.inactive} inactivos`} tone="navy" />
        <StatCard
          icon={UserCheck}
          label="Ingresaron (30 días)"
          value={users.logged_in_last_30_days}
          hint="Usuarios con inicio de sesión reciente"
          tone="slate"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Cobertura de asistencia"
          value={coverage.insufficient_data || coverage.rate === null ? 'Sin datos' : `${Math.round(coverage.rate * 100)}%`}
          hint={
            coverage.insufficient_data
              ? 'No hay periodo vigente o cursos registrados.'
              : `${coverage.courses_with_attendance} de ${coverage.courses_total} cursos · ${coverage.date_from} a ${coverage.date_to}`
          }
          tone="teal"
        />
        <StatCard
          icon={ShieldAlert}
          label="Alertas abiertas"
          value={alerts.open}
          hint={breakdown(alerts.open_by_severity, SEVERITY_LABELS) || 'Sin alertas abiertas'}
          tone="rose"
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-navy-950">Usuarios activos por rol</h2>
        <dl className="mt-4 grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-5">
          {Object.keys(API_ROLE_TO_UI).map((slug) => (
            <div key={slug} className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">{roleLabels[slug]}</dt>
              <dd className="mt-1 text-2xl font-semibold text-navy-950">{users.active_by_role?.[slug] ?? 0}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
