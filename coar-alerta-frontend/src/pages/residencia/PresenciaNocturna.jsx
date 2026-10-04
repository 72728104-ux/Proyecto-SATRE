import { useState } from 'react'
import { BedDouble, CheckCheck, Save } from 'lucide-react'
import { fetchPresences, fetchResidents, savePresencesBulk, updatePresence } from '../../api/residence'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import { SkeletonList } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { useApi, useMutation } from '../../hooks/useApi'
import { notifyError, useDebounced, useEditor, useFormState, useLoadErrorToast, usePagedList } from '../admin/shared/hooks'
import { FilterBar, FormModal, LoadError, actionButton, primaryButton, secondaryButton } from '../admin/shared/ui'
import {
  CHECK_TYPES,
  OptionList,
  PRESENCE_STATUS,
  StatusBadge,
  formatDate,
  labelOf,
  localDate,
  mapOptions,
} from './shared'

const MAX_BULK = 100
const STATUS_TONES = {
  present: 'border-teal-600 bg-teal-600 text-white',
  absent: 'border-rose-600 bg-rose-600 text-white',
  on_permission: 'border-sky-600 bg-sky-600 text-white',
}

/** `records.3.notes` → { [studentId]: { notes: 'mensaje' } } según el orden en que se enviaron. */
function rowErrorsFrom(fieldErrors, studentIds) {
  const byStudent = {}
  Object.entries(fieldErrors).forEach(([key, message]) => {
    const match = key.match(/^records\.(\d+)\.(\w+)$/)
    const studentId = match ? studentIds[Number(match[1])] : null
    if (studentId) byStudent[studentId] = { ...byStudent[studentId], [match[2]]: message }
  })
  return byStudent
}

function ResidentRow({ resident, value, dirty, errors = {}, onChange }) {
  const saved = resident.presence
  const showNotes = (value.status && value.status !== 'present') || value.notes

  return (
    <li className={`rounded-2xl border bg-white p-4 shadow-sm ${dirty ? 'border-amber-300' : 'border-slate-200'}`} data-cy="presence-row">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy-950">
            {resident.last_name}, {resident.first_name}
          </p>
          <p className="text-xs text-slate-500">
            {resident.student_code}
            {resident.classroom?.name ? ` · ${resident.classroom.name}` : ''}
            {dirty ? ' · sin guardar' : saved ? ' · registrado' : ' · pendiente'}
          </p>
        </div>
        <div role="radiogroup" aria-label={`Estado de ${resident.name}`} className="grid grid-cols-3 gap-1.5 sm:flex sm:gap-2">
          {Object.entries(PRESENCE_STATUS).map(([status, meta]) => (
            <button
              key={status}
              type="button"
              role="radio"
              aria-checked={value.status === status}
              data-cy={`presence-status-${status}`}
              onClick={() => onChange({ status })}
              className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-medium leading-tight sm:min-h-10 sm:px-3 sm:text-sm ${
                value.status === status ? STATUS_TONES[status] : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </div>
      {errors.status || errors.student_id ? <p className="mt-2 text-xs text-rose-600">{errors.status ?? errors.student_id}</p> : null}
      {showNotes ? (
        <Field
          className="mt-3"
          label="Observación"
          name={`notes-${resident.id}`}
          maxLength={500}
          value={value.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          error={errors.notes}
        />
      ) : null}
    </li>
  )
}

function ChecklistSheet({ date, checkType, onFieldErrors }) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [drafts, setDrafts] = useState({})
  const [rowErrors, setRowErrors] = useState({})
  const debouncedSearch = useDebounced(search)
  const query = useApi(
    ({ signal }) => fetchResidents({ presence_date: date, check_type: checkType, search: debouncedSearch, page }, { signal }),
    [date, checkType, debouncedSearch, page],
  )
  useLoadErrorToast(query.error)
  const save = useMutation(savePresencesBulk, { onError: (error) => notifyError(toast, error, { form: true }) })

  const rows = query.data?.data ?? []
  const pending = Object.keys(drafts).length
  const valueOf = (resident) =>
    drafts[resident.id] ?? { status: resident.presence?.status ?? null, notes: resident.presence?.notes ?? '' }

  const change = (resident, patch) => {
    setDrafts((current) => ({ ...current, [resident.id]: { ...valueOf(resident), ...current[resident.id], ...patch } }))
    setRowErrors((current) => ({ ...current, [resident.id]: undefined }))
  }

  const markPendingPresent = () => {
    const unmarked = rows.filter((resident) => !resident.presence && !drafts[resident.id]?.status)
    if (!unmarked.length) return toast.info('Todos los internos de esta página ya tienen estado.')
    setDrafts((current) => ({
      ...current,
      ...Object.fromEntries(unmarked.map((resident) => [resident.id, { status: 'present', notes: '' }])),
    }))
  }

  const submit = async () => {
    const entries = Object.entries(drafts).filter(([, draft]) => draft.status)
    if (!entries.length) return toast.warning('Marca al menos un estado antes de guardar.')
    if (entries.length > MAX_BULK) return toast.warning(`Guarda como máximo ${MAX_BULK} registros por vez.`)

    const studentIds = entries.map(([id]) => Number(id))
    const result = await save.mutate({
      presence_date: date,
      check_type: checkType,
      records: entries.map(([id, draft]) => ({ student_id: Number(id), status: draft.status, notes: draft.notes?.trim() || null })),
    })
    if (result.ok) {
      toast.success(`${entries.length} registro(s) de presencia guardados.`)
      setDrafts({})
      setRowErrors({})
      onFieldErrors({})
      query.reload()
    } else {
      const fieldErrors = result.error?.fieldErrors ?? {}
      setRowErrors(rowErrorsFrom(fieldErrors, studentIds))
      onFieldErrors(fieldErrors)
    }
  }

  let body
  if (query.error && !query.data) body = <LoadError onRetry={query.reload} />
  else if (query.loading && !query.data) body = <SkeletonList rows={5} />
  else if (!rows.length) {
    body = (
      <EmptyState
        icon={BedDouble}
        title={debouncedSearch ? 'Ningún interno coincide con la búsqueda.' : 'No hay internos activos.'}
        description="Solo se listan estudiantes activos marcados como internos de la residencia."
      />
    )
  } else {
    body = (
      <ul className="space-y-3">
        {rows.map((resident) => (
          <ResidentRow
            key={resident.id}
            resident={resident}
            value={valueOf(resident)}
            dirty={Boolean(drafts[resident.id])}
            errors={rowErrors[resident.id]}
            onChange={(patch) => change(resident, patch)}
          />
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field
          className="sm:flex-1"
          label="Buscar interno"
          name="resident_search"
          type="search"
          placeholder="Nombre o código…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <button type="button" className={secondaryButton} onClick={markPendingPresent} disabled={!rows.length}>
          <CheckCheck size={16} />
          Pendientes como presentes
        </button>
      </div>

      {body}
      <Pagination meta={query.data?.meta} onPageChange={setPage} disabled={query.loading} />

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
          <p className="text-sm text-slate-600">
            {pending ? `${pending} cambio(s) sin guardar` : 'Sin cambios pendientes'}
          </p>
          <div className="flex flex-col gap-2 min-[480px]:flex-row">
            {pending ? (
              <button type="button" className={secondaryButton} disabled={save.loading} onClick={() => setDrafts({})}>
                Descartar
              </button>
            ) : null}
            <button type="button" className={primaryButton} disabled={save.loading || !pending} onClick={submit} data-cy="save-presences">
              <Save size={16} />
              {save.loading ? 'Guardando…' : 'Guardar pase de lista'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Checklist() {
  const [date, setDate] = useState(localDate())
  const [checkType, setCheckType] = useState('night')
  const [errors, setErrors] = useState({})

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 min-[480px]:grid-cols-2">
        <Field
          label="Fecha"
          name="presence_date"
          type="date"
          max={localDate()}
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          error={errors.presence_date}
        />
        <Field as="select" label="Control" name="check_type" value={checkType} onChange={(e) => setCheckType(e.target.value)} error={errors.check_type}>
          <OptionList options={CHECK_TYPES} />
        </Field>
      </div>
      <p className="text-xs text-slate-500">Al cambiar la fecha o el control se descartan los cambios sin guardar.</p>
      <ChecklistSheet key={`${date}|${checkType}`} date={date} checkType={checkType} onFieldErrors={setErrors} />
    </div>
  )
}

function CorrectionModal({ editor }) {
  const { form, bind } = useFormState({ status: editor.editing.status, notes: editor.editing.notes ?? '' })

  return (
    <FormModal
      title={`Corregir · ${editor.editing.student_name ?? 'registro'}`}
      onClose={editor.close}
      onSubmit={() => editor.submit({ status: form.status, notes: form.notes.trim() || null })}
      loading={editor.loading}
    >
      <p className="text-sm text-slate-500">
        {formatDate(editor.editing.presence_date)} · control {labelOf(CHECK_TYPES, editor.editing.check_type).toLowerCase()}
      </p>
      <Field as="select" label="Estado" {...bind('status')} error={editor.errors.status} required>
        <OptionList options={mapOptions(PRESENCE_STATUS)} />
      </Field>
      <Field as="textarea" rows={3} label="Observación" maxLength={500} {...bind('notes')} error={editor.errors.notes} />
    </FormModal>
  )
}

function History() {
  const list = usePagedList(fetchPresences, { presence_date: '', check_type: '', status: '' })
  const editor = useEditor(updatePresence, { updated: 'Registro corregido.', onSaved: list.reload })

  return (
    <div className="space-y-4">
      <FilterBar>
        <Field label="Fecha" name="filter_date" type="date" value={list.filters.presence_date} onChange={(e) => list.setFilter('presence_date', e.target.value)} />
        <Field as="select" label="Control" name="filter_check" value={list.filters.check_type} onChange={(e) => list.setFilter('check_type', e.target.value)}>
          <option value="">Todos</option>
          <OptionList options={CHECK_TYPES} />
        </Field>
        <Field as="select" label="Estado" name="filter_status" value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)}>
          <option value="">Todos</option>
          <OptionList options={mapOptions(PRESENCE_STATUS)} />
        </Field>
      </FilterBar>

      {list.error && !list.data ? (
        <LoadError onRetry={list.reload} />
      ) : (
        <DataTable
          loading={list.loading && !list.data}
          empty={<EmptyState icon={BedDouble} title="No hay registros de presencia con estos filtros." />}
          columns={[
            { key: 'student_name', header: 'Estudiante', primary: true },
            { key: 'presence_date', header: 'Fecha', render: (row) => formatDate(row.presence_date) },
            { key: 'check_type', header: 'Control', render: (row) => labelOf(CHECK_TYPES, row.check_type) },
            { key: 'status', header: 'Estado', render: (row) => <StatusBadge map={PRESENCE_STATUS} value={row.status} /> },
            { key: 'notes', header: 'Observación', hideOnMobile: true, render: (row) => row.notes || '—' },
            {
              key: 'actions',
              header: 'Acciones',
              mobileLabel: 'Acciones',
              render: (row) => (
                <button type="button" className={actionButton} data-cy="corregir-presencia" onClick={() => editor.open(row)}>
                  Corregir
                </button>
              ),
            },
          ]}
          rows={list.rows}
        />
      )}
      <Pagination meta={list.meta} onPageChange={list.setPage} disabled={list.loading} />
      {editor.editing ? <CorrectionModal key={editor.editing.id} editor={editor} /> : null}
    </div>
  )
}

const TABS = [
  { id: 'checklist', label: 'Pase de lista' },
  { id: 'history', label: 'Historial' },
]

export default function PresenciaNocturna() {
  const [tab, setTab] = useState('checklist')

  return (
    <div className="space-y-4" data-cy="presencia-nocturna">
      <div>
        <h1 className="font-display text-2xl text-navy-950 sm:text-3xl">Presencia nocturna</h1>
        <p className="text-sm text-slate-500">Checklist móvil de internos (nocturno o matutino) y su historial.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 sm:inline-grid">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            data-cy={`presencia-tab-${item.id}`}
            onClick={() => setTab(item.id)}
            className={`min-h-11 rounded-xl px-4 text-sm font-medium sm:h-10 sm:min-h-0 ${tab === item.id ? 'bg-white text-navy-950 shadow-sm' : 'text-slate-600'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'checklist' ? <Checklist /> : <History />}
    </div>
  )
}
