import { ClipboardCheck } from 'lucide-react'
import { createPermission, fetchMyPermissions } from '../../api/student'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import { useEditor, useFormState, usePagedList } from '../admin/shared/hooks'
import { FilterBar, FormModal, LoadError, PageHeader } from '../admin/shared/ui'
import { OptionList, PERMISSION_STATUS, StatusBadge, formatDateTime, labelOf, mapOptions } from '../residencia/shared'

const PERMISSION_TYPES = [
  { value: 'salida', label: 'Salida' },
  { value: 'médica', label: 'Cita médica' },
  { value: 'familiar', label: 'Asunto familiar' },
  { value: 'académica', label: 'Actividad académica' },
]

const EMPTY_FORM = { type: 'salida', reason: '', starts_at: '', ends_at: '' }

const toIso = (value) => (value ? new Date(value).toISOString() : value)

function PermissionForm({ editor }) {
  const { form, bind } = useFormState(EMPTY_FORM)
  const { errors } = editor

  return (
    <FormModal title="Solicitar permiso de salida" onClose={editor.close} onSubmit={() => editor.submit({ ...form, starts_at: toIso(form.starts_at), ends_at: toIso(form.ends_at) })} loading={editor.loading} submitLabel="Enviar solicitud">
      <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900">
        Tu apoderado recibirá la solicitud. Si la autoriza, residencia hará la aprobación final.
      </p>
      <Field as="select" label="Tipo" required error={errors.type} {...bind('type')}>
        <OptionList options={PERMISSION_TYPES} />
      </Field>
      <Field as="textarea" rows={3} label="Motivo" required maxLength={2000} error={errors.reason} {...bind('reason')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field type="datetime-local" label="Salida" required error={errors.starts_at} {...bind('starts_at')} />
        <Field type="datetime-local" label="Retorno" required error={errors.ends_at} {...bind('ends_at')} />
      </div>
    </FormModal>
  )
}

export default function PermisosEstudiante() {
  const list = usePagedList(fetchMyPermissions, { status: '' })
  const editor = useEditor((_id, body) => createPermission(body), {
    created: 'Solicitud enviada a tu apoderado.',
    onSaved: () => list.reload(),
  })

  return (
    <div className="space-y-4" data-cy="permisos-estudiante">
      <PageHeader
        title="Permisos de salida"
        description="Solicita salidas de la residencia y revisa en qué etapa está cada una."
        actionLabel="Nueva solicitud"
        onAction={() => editor.open()}
      />

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
          empty={<EmptyState icon={ClipboardCheck} title="No tienes solicitudes de permiso." description="Usa «Nueva solicitud» para pedir una salida." />}
          columns={[
            { key: 'reason', header: 'Motivo', primary: true, render: (row) => <span className="line-clamp-2 max-w-xs">{row.reason}</span> },
            { key: 'type', header: 'Tipo', render: (row) => <span className="capitalize">{labelOf(PERMISSION_TYPES, row.type)}</span> },
            { key: 'starts_at', header: 'Salida', render: (row) => formatDateTime(row.starts_at) },
            { key: 'ends_at', header: 'Retorno', render: (row) => formatDateTime(row.ends_at) },
            { key: 'status', header: 'Estado', render: (row) => <StatusBadge map={PERMISSION_STATUS} value={row.status} /> },
          ]}
          rows={list.rows}
        />
      )}
      <Pagination meta={list.meta} onPageChange={list.setPage} disabled={list.loading} />

      {editor.editing ? <PermissionForm editor={editor} /> : null}
    </div>
  )
}
