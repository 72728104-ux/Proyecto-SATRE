import AlertBadge from '../../../components/AlertBadge'
import Field from '../../../components/Field'
import { toId } from '../../admin/shared/hooks'
import { RISK_LEVELS } from './hooks'

export function RiskBadge({ level }) {
  const meta = RISK_LEVELS[level]
  return meta ? <AlertBadge nivel={meta.badge}>{meta.label}</AlertBadge> : <AlertBadge nivel="observado">Sin datos</AlertBadge>
}

/** Sin `allowAll` controla el aula de `scope`; con `allowAll` es un filtro controlado por `value`/`onChange`. */
export function ClassroomPicker({ scope, label = 'Aula', allowAll = false, value, onChange, className = '' }) {
  const current = allowAll ? value : scope.classroomId
  const change = allowAll ? onChange : scope.setClassroomId

  return (
    <Field
      as="select"
      label={label}
      name="classroom_id"
      className={className}
      value={current ?? ''}
      onChange={(e) => change(toId(e.target.value))}
      disabled={scope.loading || scope.classrooms.length === 0}
    >
      {allowAll ? <option value="">Todas mis aulas</option> : null}
      {!allowAll && scope.classrooms.length === 0 ? (
        <option value="">{scope.loading ? 'Cargando…' : 'Sin aulas asignadas'}</option>
      ) : null}
      {scope.classrooms.map((classroom) => (
        <option key={classroom.id} value={classroom.id}>
          {classroom.name}
          {classroom.grade_level ? ` · ${classroom.grade_level}` : ''}
        </option>
      ))}
    </Field>
  )
}
