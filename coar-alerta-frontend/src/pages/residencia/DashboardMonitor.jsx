import { BedDouble, BellRing, ClipboardCheck, FileWarning } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchAlerts, fetchIncidents, fetchPermissions, fetchPresences, fetchResidents } from '../../api/residence'
import EmptyState from '../../components/EmptyState'
import Skeleton from '../../components/Skeleton'
import StatCard from '../../components/StatCard'
import { useApi } from '../../hooks/useApi'
import { LoadError, linkButton } from '../admin/shared/ui'
import { INCIDENT_CATEGORIES, INCIDENT_SEVERITY, StatusBadge, formatDateTime, labelOf, localDate } from './shared'

const settled = (result) => (result.status === 'fulfilled' ? result.value : null)
const totalOf = (payload) => payload?.meta?.total ?? null
const show = (value) => (value === null ? '—' : value)

/** Cada fuente falla por separado: una métrica sin datos muestra "—" en lugar de romper el panel. */
async function loadSummary({ signal }) {
  const options = { signal, silent: true }
  const night = { presence_date: localDate(), check_type: 'night' }
  const results = await Promise.allSettled([
    fetchResidents({}, options),
    fetchPresences(night, options),
    fetchPresences({ ...night, status: 'absent' }, options),
    fetchIncidents({ status: 'open' }, options),
    fetchIncidents({ status: 'open', severity: 'grave' }, options),
    fetchPermissions({ status: 'approved_guardian' }, options),
    fetchAlerts({ status: 'open' }, options),
  ])
  const [residents, marked, absent, incidents, severe, permissions, alerts] = results.map(settled)
  if (results.every((result) => result.status === 'rejected')) throw results[0].reason

  return {
    residents: totalOf(residents),
    marked: totalOf(marked),
    absent: totalOf(absent),
    openIncidents: totalOf(incidents),
    severeIncidents: totalOf(severe),
    pendingPermissions: totalOf(permissions),
    openAlerts: totalOf(alerts),
    latestIncidents: incidents?.data?.slice(0, 5) ?? [],
    latestPermissions: permissions?.data?.slice(0, 5) ?? [],
  }
}

function Panel({ title, to, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-navy-950">{title}</h2>
        <Link to={to} className={linkButton}>
          Ver todo
        </Link>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function DashboardMonitor() {
  const { data, loading, error, reload } = useApi(loadSummary, [])

  const header = (
    <div>
      <h1 className="font-display text-3xl text-navy-950">Resumen de residencia</h1>
      <p className="text-sm text-slate-500">Control nocturno de hoy, incidencias abiertas, permisos por resolver y alertas.</p>
    </div>
  )

  if (loading && !data) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
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

  if (error && !data) {
    return (
      <div className="space-y-6">
        {header}
        <LoadError onRetry={reload} />
      </div>
    )
  }

  const pendingTonight = data.residents !== null && data.marked !== null ? Math.max(data.residents - data.marked, 0) : null

  return (
    <div className="space-y-6">
      {header}
      <div className="grid gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={BedDouble}
          label="Control nocturno de hoy"
          value={data.residents === null ? '—' : `${show(data.marked)} / ${data.residents}`}
          hint={pendingTonight === null ? 'Sin datos de internos' : `${pendingTonight} pendientes · ${show(data.absent)} ausentes`}
          tone="navy"
        />
        <StatCard
          icon={FileWarning}
          label="Incidencias abiertas"
          value={show(data.openIncidents)}
          hint={`${show(data.severeIncidents)} graves`}
          tone="amber"
        />
        <StatCard icon={ClipboardCheck} label="Permisos por resolver" value={show(data.pendingPermissions)} hint="Ya autorizados por el apoderado" tone="teal" />
        <StatCard
          icon={BellRing}
          label="Alertas abiertas"
          value={show(data.openAlerts)}
          hint={data.openAlerts === null ? 'Módulo de alertas no disponible' : 'Riesgo de internos'}
          tone="rose"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Incidencias abiertas recientes" to="/residencia/incidencias">
          {data.latestIncidents.length ? (
            <ul className="divide-y divide-slate-100">
              {data.latestIncidents.map((incident) => (
                <li key={incident.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-950">{incident.student_name}</p>
                    <p className="text-xs text-slate-500">
                      {labelOf(INCIDENT_CATEGORIES, incident.category)} · {formatDateTime(incident.incident_at)}
                    </p>
                  </div>
                  <StatusBadge map={INCIDENT_SEVERITY} value={incident.severity} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={FileWarning} title="No hay incidencias abiertas." />
          )}
        </Panel>

        <Panel title="Permisos por resolver" to="/residencia/permisos">
          {data.latestPermissions.length ? (
            <ul className="divide-y divide-slate-100">
              {data.latestPermissions.map((permission) => (
                <li key={permission.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="truncate font-medium text-navy-950">{permission.student_name}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(permission.starts_at)} → {formatDateTime(permission.ends_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={ClipboardCheck} title="No hay permisos pendientes de resolución." />
          )}
        </Panel>
      </div>
    </div>
  )
}
