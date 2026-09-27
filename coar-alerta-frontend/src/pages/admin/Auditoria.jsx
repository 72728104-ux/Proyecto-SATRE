import { fetchAuditLogs } from '../../api/admin'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import { usePagedList } from './shared/hooks'
import { FilterBar, LoadError, UserPicker } from './shared/ui'

const formatDate = (iso) => (iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const resourceName = (row) => (row.auditable_type ? `${row.auditable_type.split('\\').pop()} #${row.auditable_id}` : '—')
const formatValue = (value) => (value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '∅'))

function Changes({ oldValues, newValues }) {
  const keys = [...new Set([...Object.keys(oldValues ?? {}), ...Object.keys(newValues ?? {})])]
  if (!keys.length) return <span className="text-slate-400">—</span>

  return (
    <details className="max-w-xs text-xs">
      <summary className="cursor-pointer text-teal-700">
        {keys.length} {keys.length === 1 ? 'campo' : 'campos'}
      </summary>
      <ul className="mt-2 space-y-1">
        {keys.map((key) => (
          <li key={key} className="break-words">
            <span className="font-medium text-slate-700">{key}:</span>{' '}
            <span className="text-rose-700 line-through">{formatValue(oldValues?.[key])}</span>{' '}
            <span className="text-emerald-700">{formatValue(newValues?.[key])}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

export default function Auditoria() {
  const list = usePagedList(fetchAuditLogs, { user_id: null, action: '', date_from: '', date_to: '' })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-navy-950">Auditoría</h1>
        <p className="text-sm text-slate-500">Cambios en usuarios, notas, asistencia, incidencias y permisos, con valor anterior y nuevo.</p>
      </div>

      <FilterBar>
        <UserPicker
          label="Usuario"
          name="user_id"
          valueKey="id"
          activeOnly={false}
          placeholder="Todos los usuarios"
          value={list.filters.user_id}
          onChange={(value) => list.setFilter('user_id', value)}
        />
        <Field
          label="Acción"
          name="action"
          placeholder="grade., user.created…"
          value={list.filters.action}
          onChange={(e) => list.setFilter('action', e.target.value)}
          hint="Filtra por prefijo."
        />
        <Field label="Desde" type="date" name="date_from" value={list.filters.date_from} onChange={(e) => list.setFilter('date_from', e.target.value)} />
        <Field label="Hasta" type="date" name="date_to" value={list.filters.date_to} onChange={(e) => list.setFilter('date_to', e.target.value)} />
      </FilterBar>

      {list.error && !list.data ? (
        <LoadError onRetry={list.reload} />
      ) : (
        <DataTable
          loading={list.loading}
          rows={list.rows}
          empty={<EmptyState title="No hay registros de auditoría con esos filtros." />}
          columns={[
            { key: 'action', header: 'Acción', primary: true, render: (row) => <code className="text-xs">{row.action}</code> },
            { key: 'created_at', header: 'Fecha', render: (row) => formatDate(row.created_at) },
            { key: 'user', header: 'Usuario', render: (row) => row.user?.name ?? 'Sistema' },
            { key: 'resource', header: 'Recurso', render: resourceName },
            { key: 'changes', header: 'Cambios', render: (row) => <Changes oldValues={row.old_values} newValues={row.new_values} /> },
            { key: 'ip_address', header: 'IP', hideOnMobile: true, render: (row) => row.ip_address ?? '—' },
          ]}
        />
      )}
      <Pagination meta={list.meta} onPageChange={list.setPage} disabled={list.loading} />
    </div>
  )
}
