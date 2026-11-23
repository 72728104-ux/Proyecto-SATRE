import { useState } from 'react'
import { fetchResidents } from '../../api/residence'
import AlertBadge from '../../components/AlertBadge'
import Field from '../../components/Field'
import { useApi } from '../../hooks/useApi'
import { toId, useDebounced } from '../admin/shared/hooks'

export const CHECK_TYPES = [
  { value: 'night', label: 'Nocturno' },
  { value: 'morning', label: 'Matutino' },
]

export const PRESENCE_STATUS = {
  present: { label: 'Presente', badge: 'present' },
  absent: { label: 'Ausente', badge: 'absent' },
  on_permission: { label: 'Con permiso', badge: 'permiso' },
}

export const INCIDENT_CATEGORIES = [
  { value: 'conducta', label: 'Conducta' },
  { value: 'salud', label: 'Salud' },
  { value: 'emocional', label: 'Emocional' },
  { value: 'convivencia', label: 'Convivencia' },
]

export const INCIDENT_SEVERITY = {
  leve: { label: 'Leve', badge: 'medio' },
  moderada: { label: 'Moderada', badge: 'alto' },
  grave: { label: 'Grave', badge: 'critico' },
}

export const INCIDENT_STATUS = {
  open: { label: 'Abierta', badge: 'pendiente_residencia' },
  resolved: { label: 'Resuelta', badge: 'autorizado' },
}

export const PERMISSION_STATUS = {
  pending_guardian: { label: 'Pendiente apoderado', badge: 'pendiente_apoderado' },
  approved_guardian: { label: 'Por resolver', badge: 'pendiente_residencia' },
  approved: { label: 'Aprobado', badge: 'autorizado' },
  rejected: { label: 'Rechazado', badge: 'critico' },
  cancelled: { label: 'Cancelado', badge: 'observado' },
}

export const labelOf = (options, value) => options.find((option) => option.value === value)?.label ?? value

/** Fecha/hora local (los controles nocturnos caen después de medianoche en UTC). */
const localIso = (date = new Date()) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString()
export const localDate = (date) => localIso(date).slice(0, 10)
export const localDateTime = (date) => localIso(date).slice(0, 16)

export const formatDate = (value) => (value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('es-PE') : '—')
export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export function StatusBadge({ map, value }) {
  const meta = map[value]
  return <AlertBadge nivel={meta?.badge ?? 'observado'}>{meta?.label ?? value}</AlertBadge>
}

export function OptionList({ options }) {
  return options.map((option) => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ))
}

export const mapOptions = (map) => Object.entries(map).map(([value, { label }]) => ({ value, label }))

/** Buscador de internos por nombre o código; devuelve el id de estudiante. */
export function ResidentPicker({ label = 'Estudiante', name = 'student_id', value, onChange, error, required }) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const { data, loading } = useApi(({ signal }) => fetchResidents({ search: debouncedSearch }, { signal }), [debouncedSearch])
  const options = data?.data ?? []

  return (
    <fieldset className="space-y-2">
      <Field
        label={label}
        name={`${name}_search`}
        type="search"
        placeholder="Buscar por nombre o código…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        required={required}
      />
      <Field as="select" aria-label={label} name={name} value={value ?? ''} onChange={(e) => onChange(toId(e.target.value))} error={error}>
        <option value="">{loading ? 'Buscando…' : 'Selecciona un interno…'}</option>
        {options.map((student) => (
          <option key={student.id} value={student.id}>
            {student.last_name}, {student.first_name} · {student.student_code}
            {student.classroom?.name ? ` · ${student.classroom.name}` : ''}
          </option>
        ))}
      </Field>
    </fieldset>
  )
}
