import { useState } from 'react'
import { AlertCircle, Plus } from 'lucide-react'
import { fetchClassrooms, fetchCourses, fetchPeriods, fetchUsers } from '../../../api/admin'
import EmptyState from '../../../components/EmptyState'
import Field from '../../../components/Field'
import Modal from '../../../components/Modal'
import { useApi } from '../../../hooks/useApi'
import { toId, useDebounced } from './hooks'

export const primaryButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60'
export const secondaryButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60'
export const linkButton = 'text-sm font-medium text-teal-700 hover:text-teal-900 disabled:opacity-50'

export function PageHeader({ title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl text-navy-950">{title}</h1>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
      {actionLabel ? (
        <button type="button" onClick={onAction} className={primaryButton}>
          <Plus size={16} />
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export function FilterBar({ children }) {
  return <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
}

export function LoadError({ onRetry }) {
  return (
    <EmptyState
      icon={AlertCircle}
      title="No se pudo cargar la información."
      description="Verifica tu conexión e inténtalo nuevamente."
      action={
        <button type="button" onClick={onRetry} className={secondaryButton}>
          Reintentar
        </button>
      }
    />
  )
}

export function FormModal({ title, onClose, onSubmit, loading, submitLabel = 'Guardar', children }) {
  return (
    <Modal open title={title} onClose={loading ? undefined : onClose}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        {children}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={loading} className={secondaryButton}>
            Cancelar
          </button>
          <button type="submit" disabled={loading} className={primaryButton}>
            {loading ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Select alimentado por un listado del backend (primera página, 15 elementos).
 * `selected` ({ id, name }) mantiene visible el valor actual aunque no venga en esa página.
 */
function ResourceSelect({ fetcher, params = {}, enabled = true, getLabel, placeholder, selected, value, onChange, ...fieldProps }) {
  const { data, loading } = useApi(
    ({ signal }) => (enabled ? fetcher(params, { signal }) : Promise.resolve(null)),
    [JSON.stringify(params), enabled],
  )
  const items = data?.data ?? []
  const showSelected = selected?.id && !items.some((item) => item.id === selected.id)

  return (
    <Field
      as="select"
      value={value ?? ''}
      onChange={(e) => onChange(toId(e.target.value))}
      disabled={!enabled || fieldProps.disabled}
      {...fieldProps}
    >
      <option value="">{enabled && loading ? 'Cargando…' : placeholder}</option>
      {showSelected ? <option value={selected.id}>{selected.name}</option> : null}
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {getLabel(item)}
        </option>
      ))}
    </Field>
  )
}

export function PeriodSelect({ placeholder = 'Selecciona un periodo', ...props }) {
  return (
    <ResourceSelect
      fetcher={fetchPeriods}
      getLabel={(period) => `${period.name}${period.is_current ? ' (vigente)' : ''}`}
      placeholder={placeholder}
      {...props}
    />
  )
}

export function ClassroomSelect({ periodId, placeholder = 'Selecciona un aula', ...props }) {
  return (
    <ResourceSelect
      fetcher={fetchClassrooms}
      params={{ academic_period_id: periodId }}
      getLabel={(classroom) => `${classroom.name} · ${classroom.grade_level}`}
      placeholder={placeholder}
      {...props}
    />
  )
}

export function CourseSelect({ periodId, classroomId, placeholder = 'Selecciona un curso', ...props }) {
  return (
    <ResourceSelect
      fetcher={fetchCourses}
      params={{ academic_period_id: periodId, classroom_id: classroomId }}
      enabled={Boolean(periodId)}
      getLabel={(course) => `${course.code} · ${course.name}`}
      placeholder={periodId ? placeholder : 'Primero elige un periodo'}
      {...props}
    />
  )
}

/**
 * Buscador de usuarios por nombre o correo. `valueKey="profile_id"` devuelve el id de docente/estudiante
 * (lo que piden aulas, cursos y matrículas); `valueKey="id"` devuelve el id de usuario.
 */
export function UserPicker({ label, name, role, valueKey = 'profile_id', activeOnly = true, value, selected, onChange, error, required, placeholder = 'Selecciona…' }) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const { data, loading } = useApi(
    ({ signal }) => fetchUsers({ role, search: debouncedSearch, is_active: activeOnly ? 1 : undefined }, { signal }),
    [role, debouncedSearch, activeOnly],
  )
  const options = (data?.data ?? []).filter((user) => user[valueKey] !== null && user[valueKey] !== undefined)
  const showSelected = value && !options.some((user) => user[valueKey] === value)

  return (
    <fieldset className="space-y-2">
      <Field
        label={label}
        name={`${name}_search`}
        type="search"
        placeholder="Buscar por nombre o correo…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        required={required}
      />
      <Field as="select" aria-label={label} name={name} value={value ?? ''} onChange={(e) => onChange(toId(e.target.value))} error={error}>
        <option value="">{loading ? 'Buscando…' : placeholder}</option>
        {showSelected ? <option value={value}>{selected?.name ?? `#${value}`}</option> : null}
        {options.map((user) => (
          <option key={user.id} value={user[valueKey]}>
            {user.name} · {user.email}
          </option>
        ))}
      </Field>
    </fieldset>
  )
}
