import { BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../../components/EmptyState'
import ScoreBadge from '../../components/ScoreBadge'
import Skeleton from '../../components/Skeleton'
import { linkButton } from '../admin/shared/ui'

/** Placeholder de carga compartido por los paneles de resumen. */
export function DashboardSkeleton() {
  return (
    <>
      <div className="grid gap-4 min-[480px]:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    </>
  )
}

export function Panel({ title, to, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-navy-950">{title}</h2>
        {to ? (
          <Link to={to} className={linkButton}>
            Ver detalle
          </Link>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Lista de promedio por curso usada por estudiante y apoderado. */
export function CourseAverageList({ courses }) {
  if (!courses?.length) return <EmptyState icon={BookOpen} title="Aún no hay notas en este periodo." />

  return (
    <ul className="divide-y divide-slate-100">
      {courses.map((course) => (
        <li key={course.course_id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate font-medium text-navy-950">{course.course_name}</p>
            <p className="text-xs text-slate-500">{course.count} evaluación(es)</p>
          </div>
          <ScoreBadge value={course.average} literal={course.literal} />
        </li>
      ))}
    </ul>
  )
}
