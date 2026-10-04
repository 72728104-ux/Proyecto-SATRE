import { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { fetchPermissions, resolvePermission } from '../../api/residence'
import ConfirmModal from '../../components/ConfirmModal'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import { useToast } from '../../components/Toast'
import { useMutation } from '../../hooks/useApi'
import { notifyError, usePagedList } from '../admin/shared/hooks'
import { FilterBar, LoadError, PageHeader, actionButton, dangerActionButton, rowActions } from '../admin/shared/ui'
import { OptionList, PERMISSION_STATUS, StatusBadge, formatDateTime, mapOptions } from './shared'

const DECISIONS = {
  approved: { title: '¿Aprobar el permiso de salida?', label: 'Aprobar', done: 'Permiso aprobado.' },
  rejected: { title: '¿Rechazar el permiso de salida?', label: 'Rechazar', done: 'Permiso rechazado.' },
}

export default function PermisosResidencia() {
  const toast = useToast()
  const list = usePagedList(fetchPermissions, { status: 'approved_guardian' })
  const [pending, setPending] = useState(null)
  const resolve = useMutation(({ id, decision }) => resolvePermission(id, decision), {
    onSuccess: () => {
      toast.success(DECISIONS[pending.decision].done)
      setPending(null)
      list.reload()
    },
    onError: (error) => notifyError(toast, error),
  })

  const canApprove = (row) => row.status === 'approved_guardian'
  const canReject = (row) => ['pending_guardian', 'approved_guardian'].includes(row.status)

  return (
    <div className="space-y-4" data-cy="permisos-residencia">
      <PageHeader title="Pases de salida" description="Permisos solicitados por los internos. Solo se aprueban los ya autorizados por el apoderado." />

      <FilterBar>
        <Field as="select" label="Estado" name="filter_status" value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)}>
          <option value="">Todos</option>
          <OptionList options={mapOptions(PERMISSION_STATUS)} />
        </Field>
      </FilterBar>

      {list.error && !list.data ? (
        <LoadError onRetry={list.reload} />
      ) : (
        <DataTable
          loading={list.loading && !list.data}
          empty={<EmptyState icon={ClipboardCheck} title="No hay permisos con estos filtros." />}
          columns={[
            { key: 'student_name', header: 'Estudiante', primary: true },
            { key: 'type', header: 'Tipo', render: (row) => <span className="capitalize">{row.type}</span> },
            { key: 'reason', header: 'Motivo', render: (row) => <span className="line-clamp-2 max-w-xs">{row.reason}</span> },
            { key: 'starts_at', header: 'Salida', render: (row) => formatDateTime(row.starts_at) },
            { key: 'ends_at', header: 'Retorno', render: (row) => formatDateTime(row.ends_at) },
            { key: 'status', header: 'Estado', render: (row) => <StatusBadge map={PERMISSION_STATUS} value={row.status} /> },
            {
              key: 'actions',
              header: 'Acciones',
              mobileLabel: 'Acciones',
              render: (row) =>
                canReject(row) ? (
                  <div className={rowActions}>
                    {canApprove(row) ? (
                      <button type="button" className={actionButton} data-cy="aprobar-permiso" onClick={() => setPending({ row, decision: 'approved' })}>
                        Aprobar
                      </button>
                    ) : null}
                    <button type="button" className={dangerActionButton} data-cy="rechazar-permiso-residencia" onClick={() => setPending({ row, decision: 'rejected' })}>
                      Rechazar
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">{row.reviewed_at ? `Resuelto ${formatDateTime(row.reviewed_at)}` : '—'}</span>
                ),
            },
          ]}
          rows={list.rows}
        />
      )}
      <Pagination meta={list.meta} onPageChange={list.setPage} disabled={list.loading} />

      <ConfirmModal
        open={Boolean(pending)}
        title={pending ? DECISIONS[pending.decision].title : ''}
        message={
          pending ? (
            <>
              <p className="font-medium text-navy-950">{pending.row.student_name}</p>
              <p className="mt-1">{pending.row.reason}</p>
              <p className="mt-1 text-xs text-slate-500">
                {formatDateTime(pending.row.starts_at)} → {formatDateTime(pending.row.ends_at)}
              </p>
            </>
          ) : null
        }
        confirmLabel={pending ? DECISIONS[pending.decision].label : 'Confirmar'}
        danger={pending?.decision === 'rejected'}
        loading={resolve.loading}
        onCancel={() => setPending(null)}
        onConfirm={() => resolve.mutate({ id: pending.row.id, decision: pending.decision })}
      />
    </div>
  )
}
