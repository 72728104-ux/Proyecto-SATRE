import { useEffect } from 'react'
import { FileWarning } from 'lucide-react'
import { fetchGuardianIncidents } from '../../api/guardian'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import { usePagedList } from '../admin/shared/hooks'
import { FilterBar, LoadError, PageHeader } from '../admin/shared/ui'
import { INCIDENT_SEVERITY, INCIDENT_STATUS, OptionList, StatusBadge, formatDateTime, labelOf, mapOptions } from '../residencia/shared'
import { INCIDENT_CATEGORIES, StudentPicker, useLinkedStudent } from './shared'

export default function IncidenciasApoderado() {
  const { students, studentId, setStudentId } = useLinkedStudent()
  const list = usePagedList(fetchGuardianIncidents, { status: '', category: '', student_id: studentId ?? '' })

  useEffect(() => {
    const next = studentId ?? ''
    if (list.filters.student_id === next) return
    list.setFilter('student_id', next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  const filterStudent = (id) => {
    setStudentId(id)
    list.setFilter('student_id', id ?? '')
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reporte de incidencias"
        description="Resumen de convivencia y conducta. Por privacidad no se muestra el detalle de salud o bienestar emocional."
      />

      <FilterBar>
        <StudentPicker students={students} studentId={studentId} onChange={filterStudent} />
        <Field as="select" label="Categoría" name="filter_category" value={list.filters.category} onChange={(e) => list.setFilter('category', e.target.value)}>
          <option value="">Todas las visibles</option>
          <OptionList options={INCIDENT_CATEGORIES} />
        </Field>
        <Field as="select" label="Estado" name="filter_status" value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)}>
          <option value="">Todos</option>
          <OptionList options={mapOptions(INCIDENT_STATUS)} />
        </Field>
      </FilterBar>

      {list.error && !list.data ? (
        <LoadError onRetry={list.reload} />
      ) : (
        <DataTable
          loading={list.loading && !list.data}
          empty={<EmptyState icon={FileWarning} title="No hay incidencias de convivencia." description="Solo se listan conducta y convivencia de tus hijos/as." />}
          columns={[
            { key: 'student_name', header: 'Estudiante', primary: true },
            { key: 'incident_at', header: 'Fecha', render: (row) => formatDateTime(row.incident_at) },
            { key: 'category', header: 'Categoría', render: (row) => labelOf(INCIDENT_CATEGORIES, row.category) },
            { key: 'severity', header: 'Gravedad', render: (row) => <StatusBadge map={INCIDENT_SEVERITY} value={row.severity} /> },
            { key: 'status', header: 'Estado', render: (row) => <StatusBadge map={INCIDENT_STATUS} value={row.status} /> },
          ]}
          rows={list.rows}
        />
      )}
      <Pagination meta={list.meta} onPageChange={list.setPage} disabled={list.loading} />
    </div>
  )
}
