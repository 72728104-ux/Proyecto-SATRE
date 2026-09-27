import { fetchCourses, saveCourse } from '../../api/admin'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import { useEditor, useFormState, usePagedList } from './shared/hooks'
import { ClassroomSelect, FilterBar, FormModal, LoadError, PageHeader, PeriodSelect, UserPicker, linkButton } from './shared/ui'

function CourseFormModal({ editor }) {
  const row = editor.editing
  const { form, set, bind } = useFormState({
    code: row.code ?? '',
    name: row.name ?? '',
    academic_period_id: row.academic_period?.id ?? null,
    classroom_id: row.classroom?.id ?? null,
    teacher_id: row.teacher?.id ?? null,
  })
  const errors = editor.errors

  return (
    <FormModal title={row.id ? 'Editar curso' : 'Nuevo curso'} onClose={editor.close} loading={editor.loading} onSubmit={() => editor.submit(form)}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Código" placeholder="MAT-5A" {...bind('code')} error={errors.code} required autoFocus />
        <Field label="Nombre" placeholder="Matemáticas" {...bind('name')} error={errors.name} required className="sm:col-span-2" />
      </div>
      <PeriodSelect
        label="Periodo académico"
        name="academic_period_id"
        value={form.academic_period_id}
        selected={row.academic_period}
        onChange={(value) => {
          set('academic_period_id', value)
          set('classroom_id', null)
        }}
        error={errors.academic_period_id}
        required
      />
      <ClassroomSelect
        label="Aula"
        name="classroom_id"
        periodId={form.academic_period_id}
        enabled={Boolean(form.academic_period_id)}
        placeholder={form.academic_period_id ? 'Selecciona un aula' : 'Primero elige un periodo'}
        value={form.classroom_id}
        selected={row.classroom}
        onChange={(value) => set('classroom_id', value)}
        error={errors.classroom_id}
        required
      />
      <UserPicker
        label="Docente"
        name="teacher_id"
        role="teacher"
        value={form.teacher_id}
        selected={row.teacher}
        onChange={(value) => set('teacher_id', value)}
        error={errors.teacher_id}
        required
      />
    </FormModal>
  )
}

export default function Cursos() {
  const list = usePagedList(fetchCourses, { academic_period_id: null, classroom_id: null })
  const editor = useEditor(saveCourse, { created: 'Curso creado.', onSaved: list.reload })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cursos y asignaciones"
        description="Cada curso pertenece a un aula y periodo, y tiene un docente responsable."
        actionLabel="Nuevo curso"
        onAction={() => editor.open()}
      />

      <FilterBar>
        <PeriodSelect
          label="Periodo"
          name="filter_period"
          placeholder="Todos los periodos"
          value={list.filters.academic_period_id}
          onChange={(value) => {
            list.setFilter('academic_period_id', value)
            list.setFilter('classroom_id', null)
          }}
        />
        <ClassroomSelect
          label="Aula"
          name="filter_classroom"
          placeholder="Todas las aulas"
          periodId={list.filters.academic_period_id}
          value={list.filters.classroom_id}
          onChange={(value) => list.setFilter('classroom_id', value)}
        />
      </FilterBar>

      {list.error && !list.data ? (
        <LoadError onRetry={list.reload} />
      ) : (
        <DataTable
          loading={list.loading}
          rows={list.rows}
          empty={<EmptyState title="No hay cursos con esos filtros." description="Crea un curso y asígnale docente y aula." />}
          columns={[
            { key: 'name', header: 'Curso', primary: true, render: (row) => `${row.code} · ${row.name}` },
            { key: 'classroom', header: 'Aula', render: (row) => row.classroom?.name ?? '—' },
            { key: 'teacher', header: 'Docente', render: (row) => row.teacher?.name ?? '—' },
            { key: 'period', header: 'Periodo', render: (row) => row.academic_period?.name ?? '—' },
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

      {editor.editing ? <CourseFormModal key={editor.editing.id ?? 'new'} editor={editor} /> : null}
    </div>
  )
}
