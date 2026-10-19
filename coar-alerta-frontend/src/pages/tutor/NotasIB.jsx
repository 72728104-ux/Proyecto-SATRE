import { useState } from 'react'
import { fetchCourseRoster, fetchGrades, saveGrade } from '../../api/teacher'
import { CriterionHeader, CriterionHelp, CriterionLetter } from '../../components/CriterionHint'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import ScoreBadge, { MineduLiteralBadge } from '../../components/ScoreBadge'
import { CRITERIA, CRITERIA_LEGEND, criterionFilterLabel } from '../../data/ibCriteria'
import { useApi } from '../../hooks/useApi'
import { MAX_SCORE, MIN_SCORE, PASSING_SCORE, isValidScore, normalizeScore } from '../../utils/mineduScale'
import { toId, useEditor, useFormState, usePagedList } from '../admin/shared/hooks'
import { FilterBar, FormModal, LoadError, PageHeader, linkButton } from '../admin/shared/ui'
import { localDate, studentName, useTeacherScope } from './shared/hooks'

const courseLabel = (course) => `${course.classroom?.name ? `${course.classroom.name} · ` : ''}${course.name}`

function validateGrade(form, isNew) {
  const errors = {}
  if (isNew && !form.course_id) errors.course_id = 'Selecciona un curso.'
  if (isNew && !form.student_id) errors.student_id = 'Selecciona un estudiante.'
  if (!form.evaluation_name.trim()) errors.evaluation_name = 'Indica el nombre de la evaluación.'
  else if (form.evaluation_name.length > 255) errors.evaluation_name = 'Máximo 255 caracteres.'
  if (!CRITERIA.includes(form.criterion)) errors.criterion = 'Elige un criterio (A–D).'
  if (!form.evaluation_date) errors.evaluation_date = 'Indica la fecha de evaluación.'
  else if (form.evaluation_date > localDate()) errors.evaluation_date = 'La fecha no puede ser futura.'
  if (!isValidScore(form.score)) {
    errors.score = `La nota debe ser un número entre ${MIN_SCORE.toFixed(2)} y ${MAX_SCORE.toFixed(2)}.`
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
    evaluation_date: row.evaluation_date ?? localDate(),
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
      score: normalizeScore(form.score),
    }
    editor.submit(isNew ? { ...body, course_id: form.course_id, student_id: form.student_id } : body)
  }

  return (
    <FormModal title={isNew ? 'Registrar nota' : 'Editar nota'} onClose={editor.close} onSubmit={submit} loading={editor.loading}>
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
        <Field
          as="select"
          label="Criterio"
          labelAddon={<CriterionHelp courseName={courses.find((course) => course.id === form.course_id)?.name ?? row.course_name} />}
          {...bind('criterion')}
          error={errors.criterion}
          required
        >
          <option value="">—</option>
          {CRITERIA.map((criterion) => (
            <option key={criterion} value={criterion}>
              {criterionFilterLabel(criterion)}
            </option>
          ))}
        </Field>
        <Field label="Fecha" type="date" max={localDate()} {...bind('evaluation_date')} error={errors.evaluation_date} required />
        <Field
          label="Nota (0–20)"
          type="number"
          inputMode="decimal"
          min={MIN_SCORE}
          max={MAX_SCORE}
          step="0.01"
          {...bind('score')}
          error={errors.score}
          hint="AD 18–20 · A 15–17 · B 11–14 · C 0–10"
          suffix={
            <span data-cy="minedu-literal-preview" data-testid="minedu-literal-preview" aria-live="polite">
              <MineduLiteralBadge score={form.score} />
            </span>
          }
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
  const selectedCourseName = scope.courses.find((course) => course.id === list.filters.course_id)?.name

  return (
    <div className="space-y-4" data-cy="notas-ib">
      <PageHeader
        title="Calificaciones"
        description={
          <>
            {`Escala vigesimal Minedu 0–20 (AD/A/B/C). Aprobatorio ≥ ${PASSING_SCORE}. Cada cambio queda auditado.`}
            <span className="mt-1.5 block text-slate-600">{CRITERIA_LEGEND}</span>
          </>
        }
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
              {criterionFilterLabel(criterion)}
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
            {
              key: 'criterion',
              header: <CriterionHeader courseName={selectedCourseName} />,
              render: (row) => <CriterionLetter letter={row.criterion} courseName={row.course_name} />,
            },
            { key: 'evaluation_date', header: 'Fecha' },
            {
              key: 'score',
              header: 'Nota',
              render: (row) => <ScoreBadge value={row.score} literal={row.literal} />,
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
