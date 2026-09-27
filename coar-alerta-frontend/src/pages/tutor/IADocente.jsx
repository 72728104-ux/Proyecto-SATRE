import { useMemo } from 'react'
import { BrainCircuit, CloudOff, Lightbulb, Users } from 'lucide-react'
import { fetchClassroomInsights } from '../../api/teacher'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import { SkeletonList } from '../../components/Skeleton'
import { useApi } from '../../hooks/useApi'
import { useLoadErrorToast } from '../admin/shared/hooks'
import { FilterBar, LoadError, secondaryButton } from '../admin/shared/ui'
import { formatNumber, formatPct, studentName, useClassroomRoster, useTeacherScope } from './shared/hooks'
import { ClassroomPicker } from './shared/ui'

const PASSING_SCORE = 4

const scoreTone = (value) =>
  value === null || value === undefined ? 'text-slate-400' : value < PASSING_SCORE ? 'font-semibold text-rose-700' : 'text-slate-700'

function GapCard({ gap, courseName }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500">{courseName}</p>
          <h3 className="font-semibold text-navy-950">Criterio {gap.criterion}</h3>
        </div>
        <p className="text-right text-sm text-slate-600">
          <span className="block text-lg font-semibold text-rose-700">{formatPct(gap.pct_below_4)}</span>
          bajo 4 · promedio {formatNumber(gap.mean)}
        </p>
      </div>
      {gap.methodologies?.length ? (
        <ul className="mt-4 space-y-2">
          {gap.methodologies.map((method) => (
            <li key={method.id} className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
              <p className="flex items-center gap-2 font-medium">
                <Lightbulb size={16} className="shrink-0" />
                {method.name}
              </p>
              <p className="mt-1 text-teal-900/80">{method.description}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Sin metodología sugerida en el catálogo para esta brecha.</p>
      )}
    </article>
  )
}

export default function IADocente() {
  const scope = useTeacherScope()
  const roster = useClassroomRoster(scope.classroomId, scope.courses)
  const insights = useApi(
    ({ signal }) => (scope.classroomId ? fetchClassroomInsights(scope.classroomId, { signal }) : Promise.resolve(null)),
    [scope.classroomId],
  )
  useLoadErrorToast(insights.error)

  const names = useMemo(
    () => new Map((roster.data ?? []).map((student) => [student.student_id, studentName(student)])),
    [roster.data],
  )
  const data = insights.data?.data
  const courseNames = new Map((data?.courses ?? []).map((course) => [course.course_id, course.course_name ?? course.course_code]))

  let body
  if (scope.error && !scope.data) body = <LoadError onRetry={scope.reload} />
  else if (!scope.loading && !scope.classroomId) body = <EmptyState icon={Users} title="No tienes aulas asignadas." />
  else if (scope.loading || (insights.loading && !insights.data)) body = <SkeletonList rows={3} />
  else if (insights.error) body = <LoadError onRetry={insights.reload} />
  else if (!data) {
    body = (
      <EmptyState
        icon={CloudOff}
        title="El motor analítico no está disponible en este momento."
        description="Las brechas se calculan cada noche; vuelve a intentarlo más tarde."
        action={
          <button type="button" className={secondaryButton} onClick={insights.reload}>
            Reintentar
          </button>
        }
      />
    )
  } else if (data.insufficient_data) {
    body = (
      <EmptyState
        icon={BrainCircuit}
        title="Aún no hay suficientes notas con criterio A–D."
        description="Registra evaluaciones por criterio en Notas IB para obtener brechas y metodologías."
      />
    )
  } else {
    body = (
      <>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-navy-950">Principales brechas</h2>
          {data.top_gaps?.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.top_gaps.map((gap) => (
                <GapCard key={`${gap.course_id}-${gap.criterion}`} gap={gap} courseName={courseNames.get(gap.course_id) ?? `Curso #${gap.course_id}`} />
              ))}
            </div>
          ) : (
            <EmptyState title="Sin brechas: todos los criterios tienen promedio aprobatorio." />
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-navy-950">Promedio por criterio</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {data.courses.map((course) => (
              <article key={course.course_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="font-semibold text-navy-950">{course.course_name ?? course.course_code}</h3>
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {course.criteria.map((item) => (
                    <div key={item.criterion} className="rounded-xl bg-slate-50 p-3 text-center">
                      <dt className="text-xs text-slate-500">Criterio {item.criterion}</dt>
                      <dd className={`mt-1 text-xl ${scoreTone(item.mean)}`}>{formatNumber(item.mean)}</dd>
                      <dd className="text-[11px] text-slate-500">{formatPct(item.pct_below_4)} bajo 4</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </section>

        {data.error_matrix?.map((matrix) => (
          <section key={matrix.course_id} className="space-y-3">
            <h2 className="text-lg font-semibold text-navy-950">
              Criterio × estudiante · {courseNames.get(matrix.course_id) ?? `Curso #${matrix.course_id}`}
            </h2>
            <DataTable
              keyField="student_id"
              rows={matrix.rows}
              columns={[
                {
                  key: 'student_id',
                  header: 'Estudiante',
                  primary: true,
                  render: (row) => names.get(row.student_id) ?? `Estudiante #${row.student_id}`,
                },
                ...matrix.criteria.map((criterion) => ({
                  key: criterion,
                  header: `Criterio ${criterion}`,
                  render: (row) => <span className={scoreTone(row[criterion])}>{formatNumber(row[criterion])}</span>,
                })),
              ]}
            />
          </section>
        ))}
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-navy-950">IA Docente</h1>
        <p className="text-sm text-slate-500">
          Brechas por criterio IB y metodologías sugeridas a partir de las notas del aula. Sin modelos de lenguaje: reglas y catálogo curado.
        </p>
      </div>

      <FilterBar>
        <ClassroomPicker scope={scope} />
      </FilterBar>

      {insights.data?.stale ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          El motor analítico no respondió; se muestra el último diagnóstico guardado.
        </p>
      ) : null}
      {insights.data?.generated_at ? (
        <p className="text-xs text-slate-500">Generado el {new Date(insights.data.generated_at).toLocaleString('es-PE')}</p>
      ) : null}

      {body}
    </div>
  )
}
