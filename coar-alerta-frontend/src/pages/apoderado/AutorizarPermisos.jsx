import { useEffect, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { fetchGuardianPermissions, respondPermissionAsGuardian } from '../../api/guardian'
import ConfirmModal from '../../components/ConfirmModal'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import { useToast } from '../../components/Toast'
import { useMutation } from '../../hooks/useApi'
import { notifyError, usePagedList } from '../admin/shared/hooks'
import { FilterBar, LoadError, PageHeader, actionButton, dangerActionButton, rowActions } from '../admin/shared/ui'
import { OptionList, PERMISSION_STATUS, StatusBadge, formatDateTime, mapOptions } from '../residencia/shared'
import { StudentPicker, useLinkedStudent } from './shared'

const DECISIONS = {
  approved: { title: '¿Autorizar esta salida?', label: 'Autorizar', done: 'Permiso autorizado.' },
  rejected: { title: '¿Rechazar esta solicitud?', label: 'Rechazar', done: 'Solicitud rechazada.' },
}

export default function AutorizarPermisos() {
  const toast = useToast()
  const { students, studentId, setStudentId } = useLinkedStudent()
  const list = usePagedList(fetchGuardianPermissions, { status: 'pending_guardian', student_id: studentId ?? '' })
  const [pending, setPending] = useState(null)

  useEffect(() => {
    const next = studentId ?? ''
    if (list.filters.student_id === next) return
    list.setFilter('student_id', next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])
  const respond = useMutation(({ id, decision }) => respondPermissionAsGuardian(id, decision), {
    onSuccess: () => {
      toast.success(DECISIONS[pending.decision].done)
      setPending(null)
      list.reload()
    },
    onError: (error) => notifyError(toast, error, { form: true }),
  })

  const filterStudent = (id) => {
    setStudentId(id)
    list.setFilter('student_id', id ?? '')
  }

  return (
    <div className="space-y-4" data-cy="autorizar-permisos">
      <PageHeader
        title="Autorizar permisos"
        description="Autoriza o rechaza las salidas que solicitó tu hijo/a. Residencia da la aprobación final."
      />

      <FilterBar>
        <StudentPicker students={students} studentId={studentId} onChange={filterStudent} />
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
          empty={<EmptyState icon={ClipboardCheck} title="No hay solicitudes de permiso." description="Cuando tu hijo/a pida una salida, aparecerá aquí." />}
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
                row.status === 'pending_guardian' ? (
                  <div className={rowActions}>
                    <button type="button" data-cy="autorizar-permiso" className={actionButton} onClick={() => setPending({ row, decision: 'approved' })}>
                      Autorizar
                    </button>
                    <button type="button" data-cy="rechazar-permiso" className={dangerActionButton} onClick={() => setPending({ row, decision: 'rejected' })}>
                      Rechazar
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">—</span>
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
            <div className="space-y-3">
              <p className="font-medium text-navy-950">{pending.row.student_name}</p>
              <p>{pending.row.reason}</p>
              <p className="text-xs text-slate-500">
                {formatDateTime(pending.row.starts_at)} → {formatDateTime(pending.row.ends_at)}
              </p>
              {respond.fieldErrors.status || respond.fieldErrors.decision ? (
                <Field
                  name={respond.fieldErrors.status ? 'status' : 'decision'}
                  label="Solicitud"
                  error={respond.fieldErrors.status ?? respond.fieldErrors.decision}
                  value={pending.row.status}
                  readOnly
                />
              ) : null}
            </div>
          ) : null
        }
        confirmLabel={pending ? DECISIONS[pending.decision].label : 'Confirmar'}
        danger={pending?.decision === 'rejected'}
        loading={respond.loading}
        onCancel={() => {
          respond.reset()
          setPending(null)
        }}
        onConfirm={() => respond.mutate({ id: pending.row.id, decision: pending.decision })}
      />
    </div>
  )
}
