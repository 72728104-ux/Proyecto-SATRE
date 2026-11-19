import { createFollowUp, createIntervention, fetchAlerts, updateAlert } from '../../api/residence'
import AlertWorkspace from '../shared/AlertWorkspace'

const INTERVENTION_TYPES = [
  { value: 'entrevista_monitor', label: 'Entrevista con monitor' },
  { value: 'reunion_apoderado', label: 'Reunión con apoderado' },
  { value: 'derivacion_psicologia', label: 'Derivación a psicología' },
  { value: 'derivacion_salud', label: 'Derivación a tópico / salud' },
  { value: 'otro', label: 'Otro' },
]

export default function AlertasResidencia() {
  return (
    <AlertWorkspace
      title="Alertas residenciales"
      description="Atiende las alertas de los internos y registra intervenciones y seguimiento."
      fetchAlerts={fetchAlerts}
      updateAlert={updateAlert}
      createIntervention={createIntervention}
      createFollowUp={createFollowUp}
      interventionTypes={INTERVENTION_TYPES}
      emptyDescription="Aquí aparecen las alertas de riesgo de los internos."
    />
  )
}
