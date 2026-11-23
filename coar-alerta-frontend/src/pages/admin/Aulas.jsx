import { fetchClassrooms, saveClassroom } from '../../api/admin'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import { toId, useEditor, useFormState, usePagedList } from './shared/hooks'
import { FilterBar, FormModal, LoadError, PageHeader, PeriodSelect, UserPicker, linkButton } from './shared/ui'

function ClassroomFormModal({ editor }) {
  const row = editor.editing
  const { form, set, bind } = useFormState({
    name: row.name ?? '',
    grade_level: row.grade_level ?? '',
    capacity: row.capacity ?? '',
    academic_period_id: row.academic_period?.id ?? null,
    tutor_id: row.tutor?.id ?? null,
  })
  const errors = editor.errors

  return (
    <FormModal
      title={row.id ? 'Editar aula' : 'Nueva aula'}
      onClose={editor.close}
      loading={editor.loading}
      onSubmit={() => editor.submit({ ...form, capacity: toId(form.capacity) })}
    >
      <Field label="Nombre" placeholder="5to A" {...bind('name')} error={errors.name} required autoFocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Grado" placeholder="5to" {...bind('grade_level')} error={errors.grade_level} required />
        <Field label="Capacidad" type="number" min="1" {...bind('capacity')} error={errors.capacity} />
      </div>
      <PeriodSelect
        label="Periodo académico"
        name="academic_period_id"
        value={form.academic_period_id}
        selected={row.academic_period}
        onChange={(value) => set('academic_period_id', value)}
        error={errors.academic_period_id}
        required
      />
      <UserPicker
        label="Tutor"
        name="tutor_id"
        role="teacher"
        placeholder="Sin tutor asignado"
        value={form.tutor_id}
        selected={row.tutor}
        onChange={(value) => set('tutor_id', value)}
        error={errors.tutor_id}
      />
    </FormModal>
  )
}

export default function Aulas() {
  const list = usePagedList(fetchClassrooms, { academic_period_id: null })
  const editor = useEditor(saveClassroom, { created: 'Aula creada.', onSaved: list.reload })

  return (
    <div className="space-y-4">
      <PageHeader title="Aulas" description="Aulas por periodo y tutor asignado." actionLabel="Nueva aula" onAction={() => editor.open()} />

      <FilterBar>
        <PeriodSelect
          label="Periodo"
          name="filter_period"
          placeholder="Todos los periodos"
          value={list.filters.academic_period_id}
          onChange={(value) => list.setFilter('academic_period_id', value)}
        />
      </FilterBar>

      {list.error && !list.data ? (
        <LoadError onRetry={list.reload} />
      ) : (
        <DataTable
          loading={list.loading}
          rows={list.rows}
          empty={<EmptyState title="No hay aulas registradas." description="Crea la primera aula del periodo." />}
          columns={[
            { key: 'name', header: 'Aula', primary: true },
            { key: 'grade_level', header: 'Grado' },
            { key: 'capacity', header: 'Capacidad', render: (row) => row.capacity ?? '—' },
            { key: 'period', header: 'Periodo', render: (row) => row.academic_period?.name ?? '—' },
            { key: 'tutor', header: 'Tutor', render: (row) => row.tutor?.name ?? 'Sin asignar' },
            {
              key: 'actions',
              header: 'Acciones',
              render: (row) => (
                <button type="button" className={linkButton} onClick={() => editor.open(row)}>
                  Editar
                </button>
              ),
            },
          ]}
        />
      )}
      <Pagination meta={list.meta} onPageChange={list.setPage} disabled={list.loading} />

      {editor.editing ? <ClassroomFormModal key={editor.editing.id ?? 'new'} editor={editor} /> : null}
    </div>
  )
}
