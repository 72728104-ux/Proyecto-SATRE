import { BookOpen } from 'lucide-react'
import { fetchMyGrades } from '../../api/student'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import Skeleton from '../../components/Skeleton'
import { usePagedList } from '../admin/shared/hooks'
import { FilterBar, LoadError, PageHeader } from '../admin/shared/ui'
import { formatDate } from '../residencia/shared'
import ScoreBadge from './ScoreBadge'
import { CRITERIA, formatScore, useMySummary } from './shared'

function CriteriaBreakdown({ courses }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {courses.map((course) => (
        <article key={course.course_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-semibold text-navy-950">{course.course_name}</h2>
            <ScoreBadge value={course.average} />
          </div>
          <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
            {CRITERIA.map((criterion) => {
              const value = course.criteria?.[criterion] ?? null
              const tone = value === null ? 'text-slate-400' : value >= 4 ? 'text-emerald-700' : 'text-rose-700'
              return (
                <div key={criterion} className="rounded-xl bg-slate-50 px-1 py-2">
                  <dt className="text-xs font-medium text-slate-500">Crit. {criterion}</dt>
                  <dd className={`mt-1 text-lg font-semibold ${tone}`}>{formatScore(value)}</dd>
                </div>
              )
            })}
          </dl>
        </article>
      ))}
    </div>
  )
}

export default function Calificaciones() {
  const { summary, loading: summaryLoading } = useMySummary()
  const list = usePagedList(fetchMyGrades, { course_id: '', criterion: '' })
  const courses = summary?.grades?.by_course ?? []
  const selectedCourses = list.filters.course_id ? courses.filter((c) => String(c.course_id) === String(list.filters.course_id)) : courses

  return (
    <div className="space-y-4" data-cy="calificaciones-estudiante">
      <PageHeader
        title="Mis calificaciones"
        description={
          summary?.grades.average != null
            ? `Promedio general IB ${formatScore(summary.grades.average)} · escala 1–7, aprobatorio ≥ 4`
            : 'Notas IB por curso (escala 1–7, aprobatorio ≥ 4) y criterios A–D.'
        }
      />

      {summaryLoading && !summary ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : selectedCourses.length ? (
        <CriteriaBreakdown courses={selectedCourses} />
      ) : !list.filters.course_id ? (
        <EmptyState icon={BookOpen} title="Aún no hay notas IB en este periodo." description="Cuando tu docente registre evaluaciones, verás el desglose por criterio A–D." />
      ) : null}

      <FilterBar>
        <Field as="select" label="Curso" name="filter_course" value={list.filters.course_id} onChange={(e) => list.setFilter('course_id', e.target.value)}>
          <option value="">Todos</option>
          {(summary?.courses ?? []).map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </Field>
        <Field as="select" label="Criterio" name="filter_criterion" value={list.filters.criterion} onChange={(e) => list.setFilter('criterion', e.target.value)}>
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
          loading={list.loading && !list.data}
          empty={<EmptyState icon={BookOpen} title="No hay calificaciones con estos filtros." />}
          columns={[
            { key: 'evaluation_name', header: 'Evaluación', primary: true },
            { key: 'course_name', header: 'Curso' },
            { key: 'criterion', header: 'Criterio', render: (row) => (row.criterion ? `Criterio ${row.criterion}` : '—') },
            { key: 'evaluation_date', header: 'Fecha', render: (row) => formatDate(row.evaluation_date) },
            { key: 'score', header: 'Nota IB', render: (row) => <ScoreBadge value={row.score} max={row.max_score} /> },
          ]}
          rows={list.rows}
        />
      )}
      <Pagination meta={list.meta} onPageChange={list.setPage} disabled={list.loading} />
    </div>
  )
}
