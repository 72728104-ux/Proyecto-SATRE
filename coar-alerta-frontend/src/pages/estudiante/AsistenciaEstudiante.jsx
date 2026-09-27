import { useState } from 'react'
import { BedDouble, ClipboardCheck } from 'lucide-react'
import { fetchMyAttendances, fetchMyPresences } from '../../api/student'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import { usePagedList } from '../admin/shared/hooks'
import { FilterBar, LoadError, PageHeader } from '../admin/shared/ui'
import { CHECK_TYPES, OptionList, PRESENCE_STATUS, StatusBadge, formatDate, labelOf, mapOptions } from '../residencia/shared'
import { ATTENDANCE_FILTERS, ATTENDANCE_STATUS, formatRate, useMySummary } from './shared'

const TABS = [
  { id: 'classroom', label: 'Aula', icon: ClipboardCheck },
  { id: 'residence', label: 'Residencia', icon: BedDouble },
]

function ClassroomAttendance({ courses }) {
  const list = usePagedList(fetchMyAttendances, { status: '', course_id: '' })

  return (
    <>
      <FilterBar>
        <Field as="select" label="Curso" name="filter_course" value={list.filters.course_id} onChange={(e) => list.setFilter('course_id', e.target.value)}>
          <option value="">Todos</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </Field>
        <Field as="select" label="Estado" name="filter_status" value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)}>
          <option value="">Todos</option>
          <OptionList options={ATTENDANCE_FILTERS} />
        </Field>
      </FilterBar>
      {list.error && !list.data ? (
        <LoadError onRetry={list.reload} />
      ) : (
        <DataTable
          loading={list.loading && !list.data}
          empty={<EmptyState icon={ClipboardCheck} title="No hay registros de asistencia con estos filtros." />}
          columns={[
            { key: 'attendance_date', header: 'Fecha', primary: true, render: (row) => formatDate(row.attendance_date) },
            { key: 'course_name', header: 'Curso', render: (row) => row.course_name ?? '—' },
            { key: 'status', header: 'Estado', render: (row) => <StatusBadge map={ATTENDANCE_STATUS} value={row.status} /> },
            { key: 'notes', header: 'Observación', hideOnMobile: true, render: (row) => row.notes || '—' },
          ]}
          rows={list.rows}
        />
      )}
      <Pagination meta={list.meta} onPageChange={list.setPage} disabled={list.loading} />
    </>
  )
}

function ResidenceAttendance() {
  const list = usePagedList(fetchMyPresences, { status: '', check_type: '' })

  return (
    <>
      <FilterBar>
        <Field as="select" label="Control" name="filter_check_type" value={list.filters.check_type} onChange={(e) => list.setFilter('check_type', e.target.value)}>
          <option value="">Todos</option>
          <OptionList options={CHECK_TYPES} />
        </Field>
        <Field as="select" label="Estado" name="filter_presence_status" value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)}>
          <option value="">Todos</option>
          <OptionList options={mapOptions(PRESENCE_STATUS)} />
        </Field>
      </FilterBar>
      {list.error && !list.data ? (
        <LoadError onRetry={list.reload} />
      ) : (
        <DataTable
          loading={list.loading && !list.data}
          empty={
            <EmptyState
              icon={BedDouble}
              title="No hay controles de residencia registrados."
              description="Si no eres interno, esta sección permanecerá vacía."
            />
          }
          columns={[
            { key: 'presence_date', header: 'Fecha', primary: true, render: (row) => formatDate(row.presence_date) },
            { key: 'check_type', header: 'Control', render: (row) => labelOf(CHECK_TYPES, row.check_type) },
            { key: 'status', header: 'Estado', render: (row) => <StatusBadge map={PRESENCE_STATUS} value={row.status} /> },
            { key: 'notes', header: 'Observación', hideOnMobile: true, render: (row) => row.notes || '—' },
          ]}
          rows={list.rows}
        />
      )}
      <Pagination meta={list.meta} onPageChange={list.setPage} disabled={list.loading} />
    </>
  )
}

export default function AsistenciaEstudiante() {
  const [tab, setTab] = useState('classroom')
  const { summary } = useMySummary()
  const rate = summary?.attendance?.rate

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mi asistencia"
        description={
          rate != null
            ? `Asistencia a clases del periodo: ${formatRate(rate)} (presente o tardanza).`
            : 'Historial de asistencia en aula y controles de residencia.'
        }
      />

      <div role="tablist" aria-label="Tipo de asistencia" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:inline-grid sm:w-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium ${
              tab === id ? 'bg-white text-navy-950 shadow-sm' : 'text-slate-600 hover:text-navy-900'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'classroom' ? <ClassroomAttendance courses={summary?.courses ?? []} /> : <ResidenceAttendance />}
    </div>
  )
}
