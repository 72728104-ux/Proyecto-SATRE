import { useState } from 'react'
import { FileWarning } from 'lucide-react'
import { fetchIncidents, saveIncident } from '../../api/residence'
import ConfirmModal from '../../components/ConfirmModal'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import { useToast } from '../../components/Toast'
import { useMutation } from '../../hooks/useApi'
import { notifyError, useEditor, useFormState, usePagedList } from '../admin/shared/hooks'
import { FilterBar, FormModal, LoadError, PageHeader, actionButton, rowActions } from '../admin/shared/ui'
import {
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITY,
  INCIDENT_STATUS,
  OptionList,
  ResidentPicker,
  StatusBadge,
  formatDateTime,
  labelOf,
  localDateTime,
  mapOptions,
} from './shared'

function IncidentModal({ editor }) {
  const incident = editor.editing
  const isNew = !incident.id
  const { form, set, bind } = useFormState({
    student_id: null,
    incident_at: incident.incident_at ? localDateTime(new Date(incident.incident_at)) : localDateTime(),
    category: incident.category ?? '',
    severity: incident.severity ?? '',
    description: incident.description ?? '',
  })
  const [clientErrors, setClientErrors] = useState({})
  const errors = { ...editor.errors, ...clientErrors }

  const submit = () => {
    const found = {
      ...(isNew && !form.student_id ? { student_id: 'Selecciona al estudiante.' } : {}),
      ...(form.incident_at ? {} : { incident_at: 'Indica la fecha y hora.' }),
      ...(form.incident_at > localDateTime() ? { incident_at: 'La fecha no puede ser futura.' } : {}),
      ...(form.category ? {} : { category: 'Elige la categoría.' }),
      ...(form.severity ? {} : { severity: 'Elige la gravedad.' }),
      ...(form.description.trim() ? {} : { description: 'Describe lo ocurrido.' }),
    }
    setClientErrors(found)
    if (Object.keys(found).length) return
    editor.submit({
      ...(isNew ? { student_id: form.student_id } : {}),
      incident_at: form.incident_at,
      category: form.category,
      severity: form.severity,
      description: form.description.trim(),
    })
  }

  return (
    <FormModal
      title={isNew ? 'Registrar incidencia' : `Editar incidencia · ${incident.student_name ?? ''}`}
      onClose={editor.close}
      onSubmit={submit}
      loading={editor.loading}
      submitLabel={isNew ? 'Registrar' : 'Guardar'}
    >
      {isNew ? (
        <ResidentPicker value={form.student_id} onChange={(value) => set('student_id', value)} error={errors.student_id} required />
      ) : null}
      <Field label="Fecha y hora" type="datetime-local" max={localDateTime()} {...bind('incident_at')} error={errors.incident_at} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field as="select" label="Categoría" {...bind('category')} error={errors.category} required>
          <option value="">Selecciona…</option>
          <OptionList options={INCIDENT_CATEGORIES} />
        </Field>
        <Field as="select" label="Gravedad" {...bind('severity')} error={errors.severity} required>
          <option value="">Selecciona…</option>
          <OptionList options={mapOptions(INCIDENT_SEVERITY)} />
        </Field>
      </div>
      <Field as="textarea" rows={4} label="Descripción" maxLength={5000} {...bind('description')} error={errors.description} required />
    </FormModal>
  )
}

export default function Incidencias() {
  const toast = useToast()
  const list = usePagedList(fetchIncidents, { status: 'open', category: '', severity: '' })
  const editor = useEditor(saveIncident, {
    created: 'Incidencia registrada.',
    updated: 'Incidencia actualizada.',
    onSaved: list.reload,
  })
  const [resolving, setResolving] = useState(null)
  const resolve = useMutation((id) => saveIncident(id, { status: 'resolved' }), {
    onSuccess: () => {
      toast.success('Incidencia resuelta.')
      setResolving(null)
      list.reload()
    },
    onError: (error) => notifyError(toast, error),
  })

  return (
    <div className="space-y-4" data-cy="incidencias">
      <PageHeader
        title="Incidencias"
        description="Registro de conducta, salud, bienestar emocional y convivencia en la residencia."
        actionLabel="Nueva incidencia"
        actionCy="nueva-incidencia"
        onAction={() => editor.open()}
      />

      <FilterBar>
        <Field as="select" label="Estado" name="filter_status" value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)}>
          <option value="">Todos</option>
          <OptionList options={mapOptions(INCIDENT_STATUS)} />
        </Field>
        <Field as="select" label="Categoría" name="filter_category" value={list.filters.category} onChange={(e) => list.setFilter('category', e.target.value)}>
          <option value="">Todas</option>
          <OptionList options={INCIDENT_CATEGORIES} />
        </Field>
        <Field as="select" label="Gravedad" name="filter_severity" value={list.filters.severity} onChange={(e) => list.setFilter('severity', e.target.value)}>
          <option value="">Todas</option>
          <OptionList options={mapOptions(INCIDENT_SEVERITY)} />
        </Field>
      </FilterBar>

      {list.error && !list.data ? (
        <LoadError onRetry={list.reload} />
      ) : (
        <DataTable
          loading={list.loading && !list.data}
          empty={<EmptyState icon={FileWarning} title="No hay incidencias con estos filtros." />}
          columns={[
            { key: 'student_name', header: 'Estudiante', primary: true },
            { key: 'incident_at', header: 'Fecha', render: (row) => formatDateTime(row.incident_at) },
            { key: 'category', header: 'Categoría', render: (row) => labelOf(INCIDENT_CATEGORIES, row.category) },
            { key: 'severity', header: 'Gravedad', render: (row) => <StatusBadge map={INCIDENT_SEVERITY} value={row.severity} /> },
            { key: 'description', header: 'Descripción', render: (row) => <span className="line-clamp-3 sm:line-clamp-2 sm:max-w-xs">{row.description}</span> },
            { key: 'status', header: 'Estado', render: (row) => <StatusBadge map={INCIDENT_STATUS} value={row.status} /> },
            {
              key: 'actions',
              header: 'Acciones',
              mobileLabel: 'Acciones',
              render: (row) => (
                <div className={rowActions}>
                  <button type="button" className={actionButton} onClick={() => editor.open(row)}>
                    Editar
                  </button>
                  {row.status === 'open' ? (
                    <button type="button" className={actionButton} data-cy="resolver-incidencia" onClick={() => setResolving(row)}>
                      Resolver
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
          rows={list.rows}
        />
      )}
      <Pagination meta={list.meta} onPageChange={list.setPage} disabled={list.loading} />

      {editor.editing ? <IncidentModal key={editor.editing.id ?? 'new'} editor={editor} /> : null}
      <ConfirmModal
        open={Boolean(resolving)}
        title="¿Marcar la incidencia como resuelta?"
        message={resolving ? `${resolving.student_name} · ${labelOf(INCIDENT_CATEGORIES, resolving.category)}` : null}
        confirmLabel="Resolver"
        loading={resolve.loading}
        onCancel={() => setResolving(null)}
        onConfirm={() => resolve.mutate(resolving.id)}
      />
    </div>
  )
}
