import { useState } from 'react'
import { BellRing, CheckCircle2, Plus } from 'lucide-react'
import { createFollowUp, createIntervention, fetchAlerts, updateAlert } from '../../api/teacher'
import AlertBadge from '../../components/AlertBadge'
import ConfirmModal from '../../components/ConfirmModal'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import { SkeletonList } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { useMutation } from '../../hooks/useApi'
import { notifyError, useEditor, useFormState, usePagedList } from '../admin/shared/hooks'
import { FilterBar, FormModal, LoadError, linkButton, secondaryButton } from '../admin/shared/ui'
import { isMissingEndpoint, useTeacherScope } from './shared/hooks'
import { ClassroomPicker, RiskBadge } from './shared/ui'

const STATUS = {
  open: { label: 'Abierta', badge: 'critico' },
  acknowledged: { label: 'En atención', badge: 'pendiente_residencia' },
  resolved: { label: 'Resuelta', badge: 'autorizado' },
}

const INTERVENTION_TYPES = [
  { value: 'tutoria', label: 'Tutoría individual' },
  { value: 'reunion_apoderado', label: 'Reunión con apoderado' },
  { value: 'plan_academico', label: 'Plan de recuperación académica' },
  { value: 'derivacion_psicologia', label: 'Derivación a psicología' },
  { value: 'otro', label: 'Otro' },
]
const OUTCOMES = [
  { value: 'mejora', label: 'Mejora' },
  { value: 'sin_cambios', label: 'Sin cambios' },
  { value: 'empeora', label: 'Empeora' },
]
const labelOf = (options, value) => options.find((option) => option.value === value)?.label ?? value

const today = () => new Date().toISOString().slice(0, 10)
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('es-PE') : '—')

function useValidatedSubmit(editor, validate, toBody) {
  const [clientErrors, setClientErrors] = useState({})
  const submit = (form) => {
    const found = validate(form)
    setClientErrors(found)
    if (!Object.keys(found).length) editor.submit(toBody(form))
  }
  return { submit, errors: { ...editor.errors, ...clientErrors } }
}

function InterventionModal({ editor }) {
  const { form, bind } = useFormState({ type: '', description: '' })
  const { submit, errors } = useValidatedSubmit(
    editor,
    (values) => ({
      ...(values.type ? {} : { type: 'Elige el tipo de intervención.' }),
      ...(values.description.trim().length >= 10 ? {} : { description: 'Describe la intervención (mínimo 10 caracteres).' }),
    }),
    (values) => ({ type: values.type, description: values.description.trim() }),
  )

  return (
    <FormModal
      title={`Intervención · ${editor.editing.student?.name ?? 'estudiante'}`}
      onClose={editor.close}
      onSubmit={() => submit(form)}
      loading={editor.loading}
      submitLabel="Registrar"
    >
      <Field as="select" label="Tipo" {...bind('type')} error={errors.type} required>
        <option value="">Selecciona…</option>
        {INTERVENTION_TYPES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Field>
      <Field as="textarea" rows={4} label="Descripción" maxLength={2000} {...bind('description')} error={errors.description} required />
    </FormModal>
  )
}

function FollowUpModal({ editor }) {
  const { form, bind } = useFormState({ follow_up_date: today(), outcome: '', notes: '' })
  const { submit, errors } = useValidatedSubmit(
    editor,
    (values) => ({
      ...(values.follow_up_date ? {} : { follow_up_date: 'Indica la fecha.' }),
      ...(values.follow_up_date > today() ? { follow_up_date: 'La fecha no puede ser futura.' } : {}),
      ...(values.notes.trim() ? {} : { notes: 'Registra lo observado en el seguimiento.' }),
    }),
    (values) => ({ follow_up_date: values.follow_up_date, outcome: values.outcome || null, notes: values.notes.trim() }),
  )

  return (
    <FormModal title="Registrar seguimiento" onClose={editor.close} onSubmit={() => submit(form)} loading={editor.loading}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha" type="date" max={today()} {...bind('follow_up_date')} error={errors.follow_up_date} required />
        <Field as="select" label="Resultado" {...bind('outcome')} error={errors.outcome}>
          <option value="">Sin evaluar</option>
          {OUTCOMES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Field>
      </div>
      <Field as="textarea" rows={4} label="Notas" maxLength={2000} {...bind('notes')} error={errors.notes} required />
    </FormModal>
  )
}

function AlertCard({ alert, onAcknowledge, onResolve, onIntervene, onFollowUp, busy }) {
  const status = STATUS[alert.status] ?? { label: alert.status, badge: 'observado' }
  const closed = alert.status === 'resolved'

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-cy="alert-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">
            {alert.student?.name ?? `Estudiante #${alert.student_id}`} · {formatDate(alert.created_at)}
          </p>
          <h3 className="mt-1 font-semibold text-navy-950">{alert.title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge level={alert.severity} />
          <AlertBadge nivel={status.badge}>{status.label}</AlertBadge>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">{alert.message}</p>

      {alert.interventions?.length ? (
        <ul className="mt-4 space-y-3">
          {alert.interventions.map((intervention) => (
            <li key={intervention.id} className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-navy-900">{labelOf(INTERVENTION_TYPES, intervention.type)}</p>
                <span className="text-xs text-slate-500">{formatDate(intervention.created_at ?? intervention.started_at)}</span>
              </div>
              <p className="mt-1 text-slate-600">{intervention.description}</p>
              {intervention.follow_ups?.length ? (
                <ul className="mt-2 space-y-1 border-l-2 border-teal-200 pl-3">
                  {intervention.follow_ups.map((followUp) => (
                    <li key={followUp.id} className="text-xs text-slate-600">
                      <span className="font-medium text-slate-700">{formatDate(followUp.follow_up_date)}</span>
                      {followUp.outcome ? ` · ${labelOf(OUTCOMES, followUp.outcome)}` : ''} — {followUp.notes}
                    </li>
                  ))}
                </ul>
              ) : null}
              {!closed ? (
                <button type="button" className={`${linkButton} mt-2`} onClick={() => onFollowUp(intervention)}>
                  + Seguimiento
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!closed ? (
        <div className="mt-4 flex flex-col gap-2 min-[480px]:flex-row min-[480px]:flex-wrap">
          <button type="button" className={secondaryButton} onClick={() => onIntervene(alert)}>
            <Plus size={16} />
            Intervención
          </button>
          {alert.status === 'open' ? (
            <button type="button" className={secondaryButton} disabled={busy} onClick={() => onAcknowledge(alert)}>
              <BellRing size={16} />
              Marcar en atención
            </button>
          ) : null}
          <button type="button" className={secondaryButton} disabled={busy} onClick={() => onResolve(alert)}>
            <CheckCircle2 size={16} />
            Resolver
          </button>
        </div>
      ) : null}
    </article>
  )
}

export default function AlertasTutor() {
  const toast = useToast()
  const scope = useTeacherScope()
  const list = usePagedList(fetchAlerts, { classroom_id: null, status: 'open' })
  const [resolving, setResolving] = useState(null)

  const statusMutation = useMutation(({ id, status }) => updateAlert(id, { status }), {
    onSuccess: () => list.reload(),
    onError: (error) => notifyError(toast, error),
  })
  const intervention = useEditor(createIntervention, { updated: 'Intervención registrada.', onSaved: list.reload })
  const followUp = useEditor(createFollowUp, { updated: 'Seguimiento registrado.', onSaved: list.reload })

  const changeStatus = async (alert, status, message) => {
    const result = await statusMutation.mutate({ id: alert.id, status })
    if (result.ok) toast.success(message)
    return result
  }

  let body
  if (isMissingEndpoint(list.error)) {
    body = (
      <EmptyState
        icon={BellRing}
        title="Las alertas aún no están disponibles."
        description="El servidor todavía no publica el módulo de alertas. Vuelve a intentarlo más adelante."
      />
    )
  } else if (list.error && !list.data) body = <LoadError onRetry={list.reload} />
  else if (list.loading) body = <SkeletonList rows={3} />
  else if (!list.rows.length) {
    body = <EmptyState icon={BellRing} title="No hay alertas con estos filtros." description="Las alertas se generan cada noche a partir del riesgo del aula." />
  } else {
    body = (
      <div className="space-y-4">
        {list.rows.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            busy={statusMutation.loading}
            onAcknowledge={(row) => changeStatus(row, 'acknowledged', 'Alerta marcada en atención.')}
            onResolve={setResolving}
            onIntervene={(row) => intervention.open(row)}
            onFollowUp={(row) => followUp.open(row)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-navy-950">Alertas e intervenciones</h1>
        <p className="text-sm text-slate-500">Atiende las alertas de tu aula y registra cada intervención y su seguimiento.</p>
      </div>

      <FilterBar>
        <ClassroomPicker
          scope={scope}
          allowAll
          value={list.filters.classroom_id}
          onChange={(value) => list.setFilter('classroom_id', value)}
        />
        <Field
          as="select"
          label="Estado"
          name="filter_status"
          value={list.filters.status}
          onChange={(e) => list.setFilter('status', e.target.value)}
        >
          <option value="">Todos</option>
          {Object.entries(STATUS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Field>
      </FilterBar>

      {body}
      <Pagination meta={list.meta} onPageChange={list.setPage} disabled={list.loading} />

      <ConfirmModal
        open={Boolean(resolving)}
        title="¿Resolver alerta?"
        message="La alerta se cerrará. Asegúrate de haber registrado las intervenciones realizadas."
        confirmLabel="Resolver"
        loading={statusMutation.loading}
        onCancel={() => setResolving(null)}
        onConfirm={async () => {
          const result = await changeStatus(resolving, 'resolved', 'Alerta resuelta.')
          if (result.ok) setResolving(null)
        }}
      />
      {intervention.editing ? <InterventionModal key={intervention.editing.id} editor={intervention} /> : null}
      {followUp.editing ? <FollowUpModal key={followUp.editing.id} editor={followUp} /> : null}
    </div>
  )
}
