import { useState } from 'react'
import { fetchCourseRoster, fetchGrades, saveGrade } from '../../api/teacher'
import AlertBadge from '../../components/AlertBadge'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import { useApi } from '../../hooks/useApi'
import { toId, useEditor, useFormState, usePagedList } from '../admin/shared/hooks'
import { FilterBar, FormModal, LoadError, PageHeader, linkButton } from '../admin/shared/ui'
import { studentName, useTeacherScope } from './shared/hooks'

const CRITERIA = ['A', 'B', 'C', 'D']
const MIN_SCORE = 1
const MAX_SCORE = 7
const PASSING_SCORE = 4

const today = () => new Date().toISOString().slice(0, 10)
const courseLabel = (course) => `${course.classroom?.name ? `${course.classroom.name} · ` : ''}${course.name}`

function validateGrade(form, isNew) {
  const errors = {}
  if (isNew && !form.course_id) errors.course_id = 'Selecciona un curso.'
  if (isNew && !form.student_id) errors.student_id = 'Selecciona un estudiante.'
  if (!form.evaluation_name.trim()) errors.evaluation_name = 'Indica el nombre de la evaluación.'
  else if (form.evaluation_name.length > 255) errors.evaluation_name = 'Máximo 255 caracteres.'
  if (!CRITERIA.includes(form.criterion)) errors.criterion = 'Elige un criterio IB (A–D).'
  if (!form.evaluation_date) errors.evaluation_date = 'Indica la fecha de evaluación.'
  else if (form.evaluation_date > today()) errors.evaluation_date = 'La fecha no puede ser futura.'
  const score = Number(form.score)
  if (form.score === '' || !Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) {
    errors.score = `La nota debe ser un entero entre ${MIN_SCORE} y ${MAX_SCORE}.`
  }
  return errors
}

function GradeFormModal({ editor, courses, defaultCourseId }) {
  const row = editor.editing
  const isNew = !row.id
  const { form, set, bind } = useFormState({
    course_id: row.course_id ?? defaultCourseId ?? courses[0]?.id ?? null,
    student_id: row.student_id ?? null,
    evaluation_name: row.evaluation_name ?? '',
    criterion: row.criterion ?? '',
    evaluation_date: row.evaluation_date ?? today(),
    score: row.score ?? '',
  })
  const [clientErrors, setClientErrors] = useState({})
  const errors = { ...editor.errors, ...clientErrors }

  const roster = useApi(
    ({ signal }) => (isNew && form.course_id ? fetchCourseRoster(form.course_id, { signal }) : Promise.resolve([])),
    [isNew, form.course_id],
  )

  const submit = () => {
    const found = validateGrade(form, isNew)
    setClientErrors(found)
    if (Object.keys(found).length) return
    const body = {
      evaluation_name: form.evaluation_name.trim(),
      criterion: form.criterion,
      evaluation_date: form.evaluation_date,
      score: Number(form.score),
    }
    editor.submit(isNew ? { ...body, course_id: form.course_id, student_id: form.student_id } : body)
  }

  return (
    <FormModal title={isNew ? 'Registrar nota IB' : 'Editar nota IB'} onClose={editor.close} onSubmit={submit} loading={editor.loading}>
      {isNew ? (
        <>
          <Field
            as="select"
            label="Curso"
            name="course_id"
            value={form.course_id ?? ''}
            onChange={(e) => {
              set('course_id', toId(e.target.value))
              set('student_id', null)
            }}
            error={errors.course_id}
            required
          >
            <option value="">Selecciona un curso</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {courseLabel(course)}
              </option>
            ))}
          </Field>
          <Field
            as="select"
            label="Estudiante"
            name="student_id"
            value={form.student_id ?? ''}
            onChange={(e) => set('student_id', toId(e.target.value))}
            error={errors.student_id}
            disabled={!form.course_id || roster.loading}
            required
          >
            <option value="">{roster.loading ? 'Cargando…' : 'Selecciona un estudiante'}</option>
            {(roster.data ?? []).map((student) => (
              <option key={student.student_id} value={student.student_id}>
                {studentName(student)} · {student.student_code}
              </option>
            ))}
          </Field>
        </>
      ) : (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {row.student_name} · {row.course_name}
        </p>
      )}
      <Field label="Evaluación" placeholder="Examen parcial 1" maxLength={255} {...bind('evaluation_name')} error={errors.evaluation_name} required />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field as="select" label="Criterio" {...bind('criterion')} error={errors.criterion} required>
          <option value="">—</option>
          {CRITERIA.map((criterion) => (
            <option key={criterion} value={criterion}>
              Criterio {criterion}
            </option>
          ))}
        </Field>
        <Field label="Fecha" type="date" max={today()} {...bind('evaluation_date')} error={errors.evaluation_date} required />
        <Field
          label="Nota (1–7)"
          type="number"
          inputMode="numeric"
          min={MIN_SCORE}
          max={MAX_SCORE}
          step="1"
          {...bind('score')}
          error={errors.score}
          required
        />
      </div>
    </FormModal>
  )
}

export default function NotasIB() {
  const scope = useTeacherScope()
  const list = usePagedList(fetchGrades, { course_id: null, criterion: '' })
  const editor = useEditor(saveGrade, { created: 'Nota registrada.', updated: 'Nota actualizada.', onSaved: list.reload })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notas IB"
        description={`Escala 1–7 por criterio A–D. Aprobatorio ≥ ${PASSING_SCORE}. Cada cambio queda auditado.`}
        actionLabel={scope.courses.length ? 'Registrar nota' : undefined}
        onAction={() => editor.open()}
      />

      <FilterBar>
        <Field
          as="select"
          label="Curso"
          name="filter_course"
          value={list.filters.course_id ?? ''}
          onChange={(e) => list.setFilter('course_id', toId(e.target.value))}
          disabled={scope.loading}
        >
          <option value="">Todos mis cursos</option>
          {scope.courses.map((course) => (
            <option key={course.id} value={course.id}>
              {courseLabel(course)}
            </option>
          ))}
        </Field>
        <Field
          as="select"
          label="Criterio"
          name="filter_criterion"
          value={list.filters.criterion}
          onChange={(e) => list.setFilter('criterion', e.target.value)}
        >
          <option value="">Todos</option>
          {CRITERIA.map((criterion) => (
            <option key={criterion} value={criterion}>
              Criterio {criterion}
            </option>
          ))}
        </Field>
      </FilterBar>

      {list.error && !list.data ? (
        <LoadError onRetry={list.reload} />
      ) : (
        <DataTable
          loading={list.loading}
          rows={list.rows}
          empty={
            <EmptyState
              title="No hay notas registradas."
              description={scope.courses.length ? 'Registra la primera evaluación de tus cursos.' : 'No tienes cursos asignados.'}
            />
          }
          columns={[
            { key: 'student_name', header: 'Estudiante', primary: true },
            { key: 'course_name', header: 'Curso' },
            { key: 'evaluation_name', header: 'Evaluación' },
            { key: 'criterion', header: 'Criterio', render: (row) => row.criterion ?? '—' },
            { key: 'evaluation_date', header: 'Fecha' },
            {
              key: 'score',
              header: 'Nota',
              render: (row) => (
                <AlertBadge nivel={row.score >= PASSING_SCORE ? 'normal' : 'critico'}>
                  {row.score} / {row.max_score ?? MAX_SCORE}
                </AlertBadge>
              ),
            },
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

      {editor.editing ? (
        <GradeFormModal
          key={editor.editing.id ?? 'new'}
          editor={editor}
          courses={scope.courses}
          defaultCourseId={list.filters.course_id}
        />
      ) : null}
    </div>
  )
}
