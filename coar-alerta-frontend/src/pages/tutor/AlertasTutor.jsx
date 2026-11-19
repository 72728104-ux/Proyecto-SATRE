import { createFollowUp, createIntervention, fetchAlerts, updateAlert } from '../../api/teacher'
import AlertWorkspace from '../shared/AlertWorkspace'
import { ClassroomPicker } from './shared/ui'
import { useTeacherScope } from './shared/hooks'

const INTERVENTION_TYPES = [
  { value: 'tutoria', label: 'Tutoría individual' },
  { value: 'reunion_apoderado', label: 'Reunión con apoderado' },
  { value: 'plan_academico', label: 'Plan de recuperación académica' },
  { value: 'derivacion_psicologia', label: 'Derivación a psicología' },
  { value: 'otro', label: 'Otro' },
]

export default function AlertasTutor() {
  const scope = useTeacherScope()

  return (
    <AlertWorkspace
      dataCy="alertas-tutor"
      title="Alertas e intervenciones"
      description="Atiende las alertas de tu aula y registra cada intervención y su seguimiento."
      fetchAlerts={fetchAlerts}
      updateAlert={updateAlert}
      createIntervention={createIntervention}
      createFollowUp={createFollowUp}
      initialFilters={{ classroom_id: null, status: 'open' }}
      interventionTypes={INTERVENTION_TYPES}
      emptyDescription="Las alertas se generan cada noche a partir del riesgo del aula."
      extraFilters={({ list }) => (
        <ClassroomPicker
          scope={scope}
          allowAll
          value={list.filters.classroom_id}
          onChange={(value) => list.setFilter('classroom_id', value)}
        />
      )}
    />
  )
}
