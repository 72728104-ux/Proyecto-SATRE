import { useEffect, useMemo, useRef, useState } from 'react'
import { BrainCircuit, CloudOff, Lightbulb, Send, Sparkles, Users } from 'lucide-react'
import { fetchClassroomInsights, sendTeacherAssistant } from '../../api/teacher'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import ErrorBoundary from '../../components/ErrorBoundary'
import Field from '../../components/Field'
import Skeleton, { SkeletonList } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { useApi, useMutation } from '../../hooks/useApi'
import { notifyError, toId, useLoadErrorToast } from '../admin/shared/hooks'
import { FilterBar, LoadError, primaryButton, secondaryButton } from '../admin/shared/ui'
import { formatPct, studentName, useClassroomRoster, useTeacherScope } from './shared/hooks'
import { ClassroomPicker } from './shared/ui'
import { PASSING_SCORE, formatScoreWithLiteral } from '../../utils/mineduScale'

const CRITERIA = ['A', 'B', 'C', 'D']

const SUGGESTED_PROMPTS = [
  '¿Qué actividades remediales sugieres para la competencia D en este grupo?',
  'Sugiere intervenciones para estudiantes en riesgo ALTO o MEDIO.',
  'Genera un resumen ejecutivo para la reunión con apoderados.',
]

const scoreTone = (value) =>
  value === null || value === undefined ? 'text-slate-400' : value < PASSING_SCORE ? 'font-semibold text-rose-700' : 'text-slate-700'

function GapCard({ gap, courseName }) {
  if (!gap) return null
  const methods = Array.isArray(gap.methodologies) ? gap.methodologies : []
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500">{courseName}</p>
          <h3 className="font-semibold text-navy-950">Criterio {gap.criterion}</h3>
        </div>
        <p className="text-right text-sm text-slate-600">
          <span className="block text-lg font-semibold text-rose-700">{formatPct(gap.pct_below_4)}</span>
          bajo {PASSING_SCORE} · promedio {formatScoreWithLiteral(gap.mean)}
        </p>
      </div>
      {methods.length ? (
        <ul className="mt-4 space-y-2">
          {methods.map((method) => (
            <li key={method?.id ?? method?.name} className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
              <p className="flex items-center gap-2 font-medium">
                <Lightbulb size={16} className="shrink-0" />
                {method?.name}
              </p>
              <p className="mt-1 text-teal-900/80">{method?.description}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Sin metodología sugerida en el catálogo para esta brecha.</p>
      )}
    </article>
  )
}

function AssistantBubble({ message }) {
  const actions = Array.isArray(message.recommended_actions) ? message.recommended_actions : []
  const materials = Array.isArray(message.suggested_materials) ? message.suggested_materials : []
  return (
    <article
      className={`max-w-[46rem] rounded-2xl px-4 py-3 text-sm ${
        message.role === 'user' ? 'ml-auto bg-navy-900 text-white' : 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'
      }`}
    >
      <p className="whitespace-pre-wrap">{message.content}</p>
      {message.summary && message.summary !== message.content ? (
        <p className="mt-2 text-xs text-slate-500">{message.summary}</p>
      ) : null}
      {actions.length ? (
        <ul className="mt-3 space-y-1.5">
          {actions.map((action) => (
            <li key={action} className="rounded-xl bg-teal-50 px-3 py-2 text-teal-950">
              {action}
            </li>
          ))}
        </ul>
      ) : null}
      {materials.length ? (
        <p className="mt-2 text-xs text-slate-500">Materiales: {materials.join(' · ')}</p>
      ) : null}
    </article>
  )
}

function TeacherAssistantChat({ classroomId, studentId, criterion, disabled }) {
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const bottomRef = useRef(null)
  const ask = useMutation((body) => sendTeacherAssistant(body), {
    onError: (error) => notifyError(toast, error, { form: true }),
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages, ask.loading])

  const send = async (text) => {
    const message = text.trim()
    if (!message || !classroomId || ask.loading) return
    const history = messages.map((item) => ({ role: item.role, content: item.content }))
    setMessages((current) => [...current, { key: `u-${current.length}`, role: 'user', content: message }])
    setDraft('')

    const result = await ask.mutate({
      classroom_id: classroomId,
      student_id: studentId || undefined,
      criterion: criterion || undefined,
      message,
      history,
    })

    if (!result.ok) {
      setMessages((current) => [
        ...current,
        {
          key: `e-${current.length}`,
          role: 'assistant',
          content: result.error?.message || 'No se pudo consultar al asistente. Inténtalo de nuevo.',
        },
      ])
      return
    }

    const payload = result.data
    const reply = payload?.data?.reply
    const textReply = reply?.text || reply?.summary || payload?.message
    if (!payload?.available || !textReply) {
      setMessages((current) => [
        ...current,
        {
          key: `e-${current.length}`,
          role: 'assistant',
          content: payload?.message || 'El asistente docente no está disponible en este momento.',
        },
      ])
      return
    }

    setMessages((current) => [
      ...current,
      {
        key: `a-${current.length}`,
        role: 'assistant',
        content: textReply,
        summary: reply.summary,
        recommended_actions: reply.recommended_actions,
        suggested_materials: reply.suggested_materials,
        criterion_focus: reply.criterion_focus,
      },
    ])
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm" data-cy="ia-docente-chat">
      <header className="flex items-start gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <Sparkles className="mt-0.5 shrink-0 text-teal-700" size={20} />
        <div>
          <h2 className="font-semibold text-navy-950">Asistente pedagógico</h2>
          <p className="text-sm text-slate-500">
            Pregunta por el aula o un alumno. Las recomendaciones usan la escala Minedu 0–20 y los criterios A–D.
          </p>
        </div>
      </header>

      <div className="max-h-[28rem] space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">
            Ejemplo: «¿Qué actividades remediales sugieres para la competencia D en este grupo?»
          </p>
        ) : (
          messages.map((message) => <AssistantBubble key={message.key} message={message} />)
        )}
        {ask.loading ? (
          <div className="flex items-center gap-3 text-sm text-slate-600" role="status" aria-live="polite">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
            El asistente está elaborando la intervención…
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-white px-5 py-3">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-left text-xs font-medium text-teal-900 hover:bg-teal-100 disabled:opacity-50"
            disabled={disabled || ask.loading || !classroomId}
            onClick={() => send(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <form
        noValidate
        className="flex flex-col gap-2 border-t border-slate-200 bg-white p-4 sm:flex-row sm:items-end"
        onSubmit={async (event) => {
          event.preventDefault()
          await send(draft)
        }}
      >
        <Field
          as="textarea"
          label="Consulta"
          name="message"
          rows={2}
          maxLength={1000}
          className="min-w-0 flex-1"
          placeholder="Ej.: ¿Qué actividades remediales sugieres para la competencia D en este grupo?"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={disabled || ask.loading || !classroomId}
          error={ask.fieldErrors.message}
        />
        <button type="submit" className={primaryButton} disabled={disabled || ask.loading || !classroomId || !draft.trim()}>
          <Send size={16} />
          {ask.loading ? 'Consultando…' : 'Preguntar'}
        </button>
      </form>
    </section>
  )
}

export default function IADocente() {
  const [boundaryKey, setBoundaryKey] = useState(0)
  return (
    <ErrorBoundary
      key={boundaryKey}
      title="No se pudo mostrar la IA Docente."
      description="El diagnóstico del aula llegó pero no se pudo interpretar. Reintenta sin recargar el resto de la plataforma."
      onReset={() => setBoundaryKey((n) => n + 1)}
    >
      <IADocenteView />
    </ErrorBoundary>
  )
}

function IADocenteView() {
  const scope = useTeacherScope()
  const roster = useClassroomRoster(scope.classroomId, scope.courses)
  const [studentId, setStudentId] = useState(null)
  const [criterion, setCriterion] = useState('')
  const insights = useApi(
    ({ signal }) => (scope.classroomId ? fetchClassroomInsights(scope.classroomId, { signal }) : Promise.resolve(null)),
    [scope.classroomId],
  )
  useLoadErrorToast(insights.error)

  useEffect(() => {
    setStudentId(null)
    setCriterion('')
  }, [scope.classroomId])

  const names = useMemo(
    () => new Map((roster.data ?? []).filter(Boolean).map((student) => [student.student_id, studentName(student)])),
    [roster.data],
  )
  const data = insights.data?.data
  const courses = Array.isArray(data?.courses) ? data.courses : []
  const topGaps = Array.isArray(data?.top_gaps) ? data.top_gaps : []
  const errorMatrix = Array.isArray(data?.error_matrix) ? data.error_matrix : []
  const courseNames = new Map(courses.map((course) => [course?.course_id, course?.course_name ?? course?.course_code]))

  let body
  if (scope.error && !scope.data) body = <LoadError onRetry={scope.reload} />
  else if (!scope.loading && !scope.classroomId) body = <EmptyState icon={Users} title="No tienes aulas asignadas." />
  else if (scope.loading || insights.loading) {
    body = (
      <div role="status" aria-live="polite" data-cy="ia-docente-loading">
        <div className="mb-3 flex items-center gap-3 text-sm text-slate-600">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          Consultando el motor analítico…
        </div>
        <SkeletonList rows={3} />
        <Skeleton className="mt-3 h-24 w-full" />
      </div>
    )
  } else if (insights.error) body = <LoadError onRetry={insights.reload} />
  else if (!data) {
    body = (
      <EmptyState
        icon={CloudOff}
        title="El motor analítico no está disponible en este momento."
        description="Las brechas se calculan cada noche; vuelve a intentarlo más tarde."
        action={
          <button type="button" className={secondaryButton} onClick={insights.reload}>
            Reintentar
          </button>
        }
      />
    )
  } else if (data.insufficient_data) {
    body = (
      <EmptyState
        icon={BrainCircuit}
        title="Aún no hay suficientes notas con criterio A–D."
        description="Registra evaluaciones por criterio en Calificaciones para obtener brechas y metodologías."
      />
    )
  } else {
    body = (
      <>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-navy-950">Principales brechas</h2>
          {topGaps.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {topGaps.map((gap) => (
                <GapCard key={`${gap?.course_id}-${gap?.criterion}`} gap={gap} courseName={courseNames.get(gap?.course_id) ?? `Curso #${gap?.course_id}`} />
              ))}
            </div>
          ) : (
            <EmptyState title="Sin brechas: todos los criterios tienen promedio aprobatorio." />
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-navy-950">Promedio por criterio</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <article key={course?.course_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="font-semibold text-navy-950">{course?.course_name ?? course?.course_code}</h3>
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(course?.criteria ?? []).map((item) => (
                    <div key={item?.criterion} className="rounded-xl bg-slate-50 p-3 text-center">
                      <dt className="text-xs text-slate-500">Criterio {item?.criterion}</dt>
                      <dd className={`mt-1 text-xl ${scoreTone(item?.mean)}`}>{formatScoreWithLiteral(item?.mean)}</dd>
                      <dd className="text-[11px] text-slate-500">{formatPct(item?.pct_below_4)} bajo {PASSING_SCORE}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </section>

        {errorMatrix.map((matrix) => (
          <section key={matrix?.course_id} className="space-y-3">
            <h2 className="text-lg font-semibold text-navy-950">
              Criterio × estudiante · {courseNames.get(matrix?.course_id) ?? `Curso #${matrix?.course_id}`}
            </h2>
            <DataTable
              keyField="student_id"
              rows={matrix?.rows ?? []}
              columns={[
                {
                  key: 'student_id',
                  header: 'Estudiante',
                  primary: true,
                  render: (row) => names.get(row?.student_id) ?? `Estudiante #${row?.student_id}`,
                },
                ...(matrix?.criteria ?? []).map((item) => ({
                  key: item,
                  header: `Criterio ${item}`,
                  render: (row) => <span className={scoreTone(row?.[item])}>{formatScoreWithLiteral(row?.[item])}</span>,
                })),
              ]}
            />
          </section>
        ))}
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-navy-950">IA Docente</h1>
        <p className="text-sm text-slate-500">
          Asistente conversacional híbrido: consultas en lenguaje natural más brechas por criterio A–D (escala Minedu 0–20).
        </p>
      </div>

      <FilterBar>
        <ClassroomPicker scope={scope} />
        <Field
          as="select"
          label="Estudiante (opcional)"
          name="student_id"
          value={studentId ?? ''}
          onChange={(event) => setStudentId(toId(event.target.value))}
          disabled={!scope.classroomId || roster.loading}
        >
          <option value="">Todo el aula</option>
          {(roster.data ?? []).map((student) => (
            <option key={student.student_id} value={student.student_id}>
              {studentName(student)}
            </option>
          ))}
        </Field>
        <Field as="select" label="Criterio" name="criterion" value={criterion} onChange={(event) => setCriterion(event.target.value)}>
          <option value="">Todos (A–D)</option>
          {CRITERIA.map((item) => (
            <option key={item} value={item}>
              Criterio {item}
            </option>
          ))}
        </Field>
      </FilterBar>

      {scope.classroomId ? (
        <TeacherAssistantChat
          key={`${scope.classroomId}-${studentId ?? 'aula'}-${criterion || 'all'}`}
          classroomId={scope.classroomId}
          studentId={studentId}
          criterion={criterion}
          disabled={!scope.classroomId}
        />
      ) : null}

      {insights.data?.stale ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          El motor analítico no respondió; se muestra el último diagnóstico guardado.
        </p>
      ) : null}
      {insights.data?.generated_at ? (
        <p className="text-xs text-slate-500">Generado el {new Date(insights.data.generated_at).toLocaleString('es-PE')}</p>
      ) : null}

      {body}
    </div>
  )
}
