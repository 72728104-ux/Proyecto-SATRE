import { BedDouble, BookOpen, ClipboardCheck, Users } from 'lucide-react'
import EmptyState from '../../components/EmptyState'
import StatCard from '../../components/StatCard'
import { useAuth } from '../../context/AuthContext'
import { LoadError } from '../admin/shared/ui'
import { CourseAverageList, DashboardSkeleton, Panel } from '../shared/DashboardBlocks'
import {
  ATTENDANCE_STATUS,
  PASSING_SCORE,
  RESIDENCE_STATUS,
  StudentPicker,
  formatRate,
  formatScoreWithLiteral,
  useChildSummary,
  useLinkedStudent,
} from './shared'

function StatusGrid({ map, byStatus }) {
  const rows = Object.entries(byStatus ?? {}).filter(([, total]) => total > 0)
  if (!rows.length) return <EmptyState icon={ClipboardCheck} title="Sin registros en este periodo." />

  return (
    <dl className="grid gap-3 min-[480px]:grid-cols-2">
      {rows.map(([status, total]) => (
        <div key={status} className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">{map[status]?.label ?? status}</dt>
          <dd className="mt-1 text-xl font-semibold text-navy-950">{total}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function DashboardApoderado() {
  const { collegeHasResidence } = useAuth()
  const { students, studentId, student, setStudentId } = useLinkedStudent()
  const { summary, loading, error, reload } = useChildSummary(studentId)

  const header = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl text-navy-950">Resumen del hijo/a</h1>
        <p className="text-sm text-slate-500">
          {summary
            ? [summary.student?.name, summary.student?.classroom, summary.academic_period?.name].filter(Boolean).join(' · ')
            : student
              ? [student.name, student.classroom].filter(Boolean).join(' · ')
              : collegeHasResidence
                ? 'Promedio Minedu, rendimiento y asistencia en aula y residencia.'
                : 'Promedio Minedu, rendimiento y asistencia en aula.'}
        </p>
      </div>
      <StudentPicker students={students} studentId={studentId} onChange={setStudentId} className="sm:w-72" />
    </div>
  )

  if (!students.length) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={Users}
          title="No hay estudiantes vinculados."
          description="Cuando la administración vincule a tu hijo/a, aquí verás su resumen académico."
        />
      </div>
    )
  }

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        {header}
        <DashboardSkeleton />
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="space-y-6">
        {header}
        <LoadError onRetry={reload} />
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState icon={Users} title="Selecciona un hijo/a para ver su resumen." />
      </div>
    )
  }

  const { grades, attendance, residence } = summary
  const failing = grades.failing_courses

  return (
    <div className="space-y-6" data-cy="dashboard-apoderado">
      {header}

      <div className="grid gap-4 min-[480px]:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={BookOpen}
          label="Promedio"
          value={formatScoreWithLiteral(grades.average, grades.literal)}
          hint={
            grades.average === null
              ? 'Aún no hay notas registradas'
              : `Escala 0–20 · ${failing} curso(s) por debajo de ${PASSING_SCORE}`
          }
          tone={grades.average !== null && grades.average < PASSING_SCORE ? 'rose' : 'navy'}
        />
        <StatCard
          icon={ClipboardCheck}
          label="Asistencia en aula"
          value={formatRate(attendance.rate)}
          hint={attendance.total ? `${attendance.total} registros de clase` : 'Sin registros de asistencia'}
          tone="teal"
        />
        {collegeHasResidence ? (
          <StatCard
            icon={BedDouble}
            label="Presencia en residencia"
            value={residence ? formatRate(residence.rate) : '—'}
            hint={
              residence
                ? residence.total
                  ? `${residence.total} registros nocturnos`
                  : 'Sin registros de residencia'
                : 'No es interno en este periodo'
            }
            tone="amber"
          />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Rendimiento por curso">
          <CourseAverageList courses={grades.by_course} />
        </Panel>

        <Panel title="Asistencias e inasistencias en aula">
          <StatusGrid map={ATTENDANCE_STATUS} byStatus={attendance.by_status} />
        </Panel>
      </div>

      {collegeHasResidence && residence ? (
        <Panel title="Asistencias e inasistencias en residencia">
          <StatusGrid map={RESIDENCE_STATUS} byStatus={residence.by_status} />
        </Panel>
      ) : null}
    </div>
  )
}
