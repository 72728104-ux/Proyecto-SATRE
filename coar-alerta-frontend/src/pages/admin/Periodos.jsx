import { useState } from 'react'
import { fetchPeriods, savePeriod, setCurrentPeriod } from '../../api/admin'
import ConfirmModal from '../../components/ConfirmModal'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import { useToast } from '../../components/Toast'
import { useMutation } from '../../hooks/useApi'
import { notifyError, useEditor, useFormState, usePagedList } from './shared/hooks'
import { FormModal, LoadError, PageHeader, linkButton } from './shared/ui'

function PeriodFormModal({ editor }) {
  const row = editor.editing
  const { form, bind } = useFormState({ name: row.name ?? '', start_date: row.start_date ?? '', end_date: row.end_date ?? '' })
  const errors = editor.errors

  return (
    <FormModal title={row.id ? 'Editar periodo' : 'Nuevo periodo'} onClose={editor.close} loading={editor.loading} onSubmit={() => editor.submit(form)}>
      <Field label="Nombre" placeholder="2026" {...bind('name')} error={errors.name} required autoFocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Inicio" type="date" {...bind('start_date')} error={errors.start_date} required />
        <Field label="Fin" type="date" {...bind('end_date')} error={errors.end_date} required />
      </div>
    </FormModal>
  )
}

export default function Periodos() {
  const toast = useToast()
  const list = usePagedList(fetchPeriods)
  const editor = useEditor(savePeriod, { created: 'Periodo creado.', onSaved: list.reload })
  const [pending, setPending] = useState(null)
  const markCurrent = useMutation((period) => setCurrentPeriod(period.id), { onError: (error) => notifyError(toast, error) })

  const confirmCurrent = async () => {
    const result = await markCurrent.mutate(pending)
    setPending(null)
    if (!result.ok) return
    toast.success(result.data.message)
    list.reload()
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Periodos académicos"
        description="Solo un periodo puede estar vigente; es el que usan asistencia, notas y métricas."
        actionLabel="Nuevo periodo"
        onAction={() => editor.open()}
      />

      {list.error && !list.data ? (
        <LoadError onRetry={list.reload} />
      ) : (
        <DataTable
          loading={list.loading}
          rows={list.rows}
          empty={<EmptyState title="No hay periodos registrados." description="Crea el periodo académico en curso." />}
          columns={[
            { key: 'name', header: 'Periodo', primary: true },
            { key: 'start_date', header: 'Inicio' },
            { key: 'end_date', header: 'Fin' },
            {
              key: 'is_current',
              header: 'Estado',
              render: (row) =>
                row.is_current ? (
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">Vigente</span>
                ) : (
                  <span className="text-xs text-slate-500">—</span>
                ),
            },
            {
              key: 'actions',
              header: 'Acciones',
              render: (row) => (
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <button type="button" className={linkButton} onClick={() => editor.open(row)}>
                    Editar
                  </button>
                  {!row.is_current ? (
                    <button type="button" className={linkButton} onClick={() => setPending(row)}>
                      Marcar vigente
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}
      <Pagination meta={list.meta} onPageChange={list.setPage} disabled={list.loading} />

      {editor.editing ? <PeriodFormModal key={editor.editing.id ?? 'new'} editor={editor} /> : null}

      <ConfirmModal
        open={Boolean(pending)}
        loading={markCurrent.loading}
        title="Cambiar periodo vigente"
        message={`${pending?.name} pasará a ser el periodo vigente y el actual dejará de serlo.`}
        confirmLabel="Marcar vigente"
        onConfirm={confirmCurrent}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
