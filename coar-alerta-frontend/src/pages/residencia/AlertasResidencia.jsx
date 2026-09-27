import { useState } from 'react'
import { BellRing, CheckCircle2, Plus } from 'lucide-react'
import { createFollowUp, createIntervention, fetchAlerts, updateAlert } from '../../api/residence'
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
import { isMissingEndpoint } from '../tutor/shared/hooks'
import { RiskBadge } from '../tutor/shared/ui'
import { OptionList, formatDate, labelOf, localDate } from './shared'

const STATUS = {
  open: { label: 'Abierta', badge: 'critico' },
  acknowledged: { label: 'En atención', badge: 'pendiente_residencia' },
  resolved: { label: 'Resuelta', badge: 'autorizado' },
}

const INTERVENTION_TYPES = [
  { value: 'entrevista_monitor', label: 'Entrevista con monitor' },
  { value: 'reunion_apoderado', label: 'Reunión con apoderado' },
  { value: 'derivacion_psicologia', label: 'Derivación a psicología' },
  { value: 'derivacion_salud', label: 'Derivación a tópico / salud' },
  { value: 'otro', label: 'Otro' },
]
const OUTCOMES = [
  { value: 'mejora', label: 'Mejora' },
  { value: 'sin_cambios', label: 'Sin cambios' },
  { value: 'empeora', label: 'Empeora' },
]

function InterventionModal({ editor }) {
  const { form, bind } = useFormState({ type: '', description: '' })
  const [clientErrors, setClientErrors] = useState({})
  const errors = { ...editor.errors, ...clientErrors }
  const submit = () => {
    const found = {
      ...(form.type ? {} : { type: 'Elige el tipo de intervención.' }),
      ...(form.description.trim().length >= 10 ? {} : { description: 'Describe la intervención (mínimo 10 caracteres).' }),
    }
    setClientErrors(found)
    if (!Object.keys(found).length) editor.submit({ type: form.type, description: form.description.trim() })
  }

  return (
    <FormModal title={`Intervención · ${editor.editing.student?.name ?? 'estudiante'}`} onClose={editor.close} onSubmit={submit} loading={editor.loading} submitLabel="Registrar">
      <Field as="select" label="Tipo" {...bind('type')} error={errors.type} required>
        <option value="">Selecciona…</option>
        <OptionList options={INTERVENTION_TYPES} />
      </Field>
      <Field as="textarea" rows={4} label="Descripción" maxLength={2000} {...bind('description')} error={errors.description} required />
    </FormModal>
  )
}

function FollowUpModal({ editor }) {
  const { form, bind } = useFormState({ follow_up_date: localDate(), outcome: '', notes: '' })
  const [clientErrors, setClientErrors] = useState({})
  const errors = { ...editor.errors, ...clientErrors }
  const submit = () => {
    const found = {
      ...(form.follow_up_date ? {} : { follow_up_date: 'Indica la fecha.' }),
      ...(form.follow_up_date > localDate() ? { follow_up_date: 'La fecha no puede ser futura.' } : {}),
      ...(form.notes.trim() ? {} : { notes: 'Registra lo observado en el seguimiento.' }),
    }
    setClientErrors(found)
    if (!Object.keys(found).length) {
      editor.submit({ follow_up_date: form.follow_up_date, outcome: form.outcome || null, notes: form.notes.trim() })
    }
  }

  return (
    <FormModal title="Registrar seguimiento" onClose={editor.close} onSubmit={submit} loading={editor.loading}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha" type="date" max={localDate()} {...bind('follow_up_date')} error={errors.follow_up_date} required />
        <Field as="select" label="Resultado" {...bind('outcome')} error={errors.outcome}>
          <option value="">Sin evaluar</option>
          <OptionList options={OUTCOMES} />
        </Field>
      </div>
      <Field as="textarea" rows={4} label="Notas" maxLength={2000} {...bind('notes')} error={errors.notes} required />
    </FormModal>
  )
}

function AlertCard({ alert, busy, onAcknowledge, onResolve, onIntervene, onFollowUp }) {
  const status = STATUS[alert.status] ?? { label: alert.status, badge: 'observado' }
  const closed = alert.status === 'resolved'

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" data-cy="alert-card">
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

export default function AlertasResidencia() {
  const toast = useToast()
  const list = usePagedList(fetchAlerts, { status: 'open' })
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
    body = <EmptyState icon={BellRing} title="No hay alertas con estos filtros." description="Aquí aparecen las alertas de riesgo de los internos." />
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
        <h1 className="font-display text-3xl text-navy-950">Alertas residenciales</h1>
        <p className="text-sm text-slate-500">Atiende las alertas de los internos y registra intervenciones y seguimiento.</p>
      </div>

      <FilterBar>
        <Field as="select" label="Estado" name="filter_status" value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)}>
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
