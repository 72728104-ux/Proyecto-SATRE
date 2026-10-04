import { fetchMyRisk, fetchMySummary } from '../../api/student'
import { useApi } from '../../hooks/useApi'
import { useLoadErrorToast } from '../admin/shared/hooks'

export const PASSING_SCORE = 4
export const CRITERIA = ['A', 'B', 'C', 'D']

export const ALERT_STATUS = {
  open: { label: 'Abierta', badge: 'pendiente_residencia' },
  acknowledged: { label: 'En seguimiento', badge: 'observado' },
  resolved: { label: 'Resuelta', badge: 'autorizado' },
}

/** `GET /alerts` no expone `title` al estudiante; el resumen sí puede traerlo. */
export const alertText = (alert) => alert?.message || alert?.title || 'Alerta'

/** Incluye los estados previos a la migración (`absent`, `justified`). */
export const ATTENDANCE_STATUS = {
  present: { label: 'Presente', badge: 'present' },
  late: { label: 'Tardanza', badge: 'late' },
  absent_justified: { label: 'Falta justificada', badge: 'justified' },
  justified: { label: 'Falta justificada', badge: 'justified' },
  absent_unjustified: { label: 'Falta injustificada', badge: 'absent' },
  absent: { label: 'Falta injustificada', badge: 'absent' },
}

/** Valores que hoy acepta `Attendance::STATUSES` en el backend. */
export const ATTENDANCE_FILTERS = [
  { value: 'present', label: 'Presente' },
  { value: 'late', label: 'Tardanza' },
  { value: 'justified', label: 'Falta justificada' },
  { value: 'absent', label: 'Falta injustificada' },
]

export const TUTOR_STATUS = {
  active: { label: 'En curso', badge: 'pendiente_residencia' },
  completed: { label: 'Completada', badge: 'autorizado' },
  no_catalog: { label: 'Sin guía', badge: 'observado' },
}

export const formatScore = (value) => (value === null || value === undefined ? '—' : Number(value).toFixed(1))
export const formatRate = (rate) => (rate === null || rate === undefined ? '—' : `${Math.round(rate * 1000) / 10}%`)

export function useMySummary() {
  const query = useApi(({ signal }) => fetchMySummary({ signal }), [])
  useLoadErrorToast(query.error)
  return { ...query, summary: query.data?.data ?? null }
}

/** Solo nivel + recomendación. `available:false` no es error: aún no hay predicción guardada. */
export function useMyRisk(studentId) {
  const query = useApi(
    ({ signal }) => (studentId ? fetchMyRisk(studentId, { signal }) : Promise.resolve(null)),
    [studentId],
  )
  useLoadErrorToast(query.error)
  const pending = Boolean(studentId) && query.data === null && !query.error
  return {
    ...query,
    loading: query.loading || pending,
    available: Boolean(query.data?.available),
    risk: query.data?.available ? query.data.data : null,
  }
}
