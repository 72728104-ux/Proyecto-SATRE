import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { History, MessageSquareText, Newspaper, Send, Sparkles, Trash2 } from 'lucide-react'
import { buildTutorIntentBody, buildTutorStartBody, deleteTutorSession, fetchTutorSessions, sendTutorTurn, tutorSeedFromSearch } from '../../api/student'
import ConfirmModal from '../../components/ConfirmModal'
import EmptyState from '../../components/EmptyState'
import ErrorBoundary from '../../components/ErrorBoundary'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import Skeleton, { SkeletonList } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { useMutation } from '../../hooks/useApi'
import { notifyError, toId, usePagedList } from '../admin/shared/hooks'
import { LoadError, PageHeader, primaryButton, secondaryButton } from '../admin/shared/ui'
import { StatusBadge, formatDateTime } from '../residencia/shared'
import { TUTOR_STATUS, useMySummary } from './shared'
import { createPhaseOf, displayStudentText, normalizeTutorReply, quizFromMessage } from './tutor/createProtocol'
import ArticleStudio from './tutor/ArticleStudio'
import CreatePhaseBar from './tutor/CreatePhaseBar'
import HintActions from './tutor/HintActions'
import TutorBubble from './tutor/TutorBubble'

const MAX_HINTS = 3

const toBubbles = (messages = []) =>
  (Array.isArray(messages) ? messages : []).map((message) => {
    const reply = normalizeTutorReply(message)
    return {
      key: `m-${message?.id}`,
      role: message?.role,
      content: message?.role === 'student' ? displayStudentText(message?.content) : (message?.content ?? ''),
      ...reply,
    }
  })

let localKey = 0
const bubble = (role, content, extra = {}) => ({
  key: `l-${++localKey}`,
  role,
  content: role === 'student' ? displayStudentText(content) : content,
  ...normalizeTutorReply(extra),
})

function TutorLoading({ label = 'El tutor está elaborando la respuesta…' }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" data-cy="tutor-loading">
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
        {label}
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-10 w-2/3 rounded-2xl" />
    </div>
  )
}

function StartForm({ courses, errors, loading, onStart, initial = null }) {
  const [courseId, setCourseId] = useState(initial?.course_id ?? null)
  const [topic, setTopic] = useState(initial?.topic ?? '')
  const criterion = initial?.criterion ?? null

  if (!courses.length && !courseId) {
    return <EmptyState icon={Sparkles} title="No tienes cursos matriculados en el periodo vigente." />
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onStart(buildTutorStartBody({ course_id: courseId, topic: topic.trim(), criterion }))
      }}
    >
      <p className="text-sm text-slate-600">
        {criterion
          ? 'Tema y criterio IB cargados desde la lectura. El tutor te guiará con preguntas y pistas; no te dará la respuesta final.'
          : 'Elige el curso y escribe el tema. Luego puedes conversar o abrir Redactar y Publicar Artículo con la metodología C.R.E.A.T.E.'}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field as="select" label="Curso" name="course_id" required value={courseId ?? ''} onChange={(e) => setCourseId(toId(e.target.value))} error={errors.course_id}>
          <option value="">Selecciona un curso…</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </Field>
        <Field
          label="Tema"
          name="topic"
          required
          maxLength={150}
          placeholder="Ej.: funciones lineales"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          error={errors.topic}
        />
      </div>
      {criterion ? (
        <p className="text-sm text-slate-600">
          Criterio IB <span className="font-semibold text-navy-950">{criterion}</span>
        </p>
      ) : null}
      <button type="submit" className={`${primaryButton} w-full sm:w-auto`} disabled={loading}>
        <Sparkles size={16} />
        {loading ? 'Iniciando…' : 'Comenzar sesión'}
      </button>
    </form>
  )
}

function Composer({ errors, loading, onMessage }) {
  const [draft, setDraft] = useState('')

  return (
    <form
      noValidate
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault()
        if (draft.trim()) onMessage(draft.trim())
      }}
    >
      <Field
        as="textarea"
        rows={2}
        label="Tu respuesta"
        name="message"
        className="flex-1"
        maxLength={1000}
        placeholder="Explica con tus palabras cómo lo estás pensando…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        error={errors.message}
      />
      <button type="submit" className={primaryButton} disabled={loading || !draft.trim()}>
        <Send size={16} />
        Enviar
      </button>
    </form>
  )
}

function SessionHistory({ list, activeId, hiddenIds, onOpen, onDelete }) {
  const rows = list.rows.filter((session) => !hiddenIds.has(session.id))

  return (
    <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 font-semibold text-navy-950">
        <History size={18} />
        Mis sesiones
      </h2>
      {list.error && !list.data ? (
        <LoadError onRetry={list.reload} />
      ) : list.loading && !list.data ? (
        <SkeletonList rows={3} />
      ) : rows.length ? (
        <ul className="space-y-2">
          {rows.map((session) => (
            <li key={session.id} className="flex items-stretch gap-1">
              <button
                type="button"
                onClick={() => onOpen(session)}
                aria-current={session.id === activeId ? 'true' : undefined}
                className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-left hover:border-teal-400 ${
                  session.id === activeId ? 'border-teal-500 bg-teal-50' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-navy-950">{session.topic}</span>
                  <StatusBadge map={TUTOR_STATUS} value={session.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {session.course_name} · {formatDateTime(session.updated_at)}
                </p>
              </button>
              <button
                type="button"
                data-cy="delete-tutor-session"
                aria-label={`Eliminar sesión ${session.topic}`}
                onClick={() => onDelete(session)}
                className="inline-flex h-auto shrink-0 items-center justify-center rounded-xl border border-transparent px-2 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={History} title="Aún no tienes sesiones." />
      )}
      <Pagination meta={list.meta} onPageChange={list.setPage} disabled={list.loading} />
    </aside>
  )
}

export default function IATutor() {
  const [boundaryKey, setBoundaryKey] = useState(0)
  return (
    <ErrorBoundary
      key={boundaryKey}
      title="No se pudo mostrar el IA Tutor."
      description="La respuesta del motor de analítica no se pudo interpretar. Reintenta la sesión sin recargar el resto de la plataforma."
      onReset={() => setBoundaryKey((n) => n + 1)}
    >
      <IATutorView />
    </ErrorBoundary>
  )
}

function IATutorView() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const seedRef = useRef(tutorSeedFromSearch(searchParams))
  const seed = seedRef.current
  const startedRef = useRef(false)
  const { summary, loading: summaryLoading, error: summaryError, reload: reloadSummary } = useMySummary()
  const history = usePagedList(fetchTutorSessions)
  const [session, setSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [panel, setPanel] = useState('chat')
  const [preloaded, setPreloaded] = useState(!seed)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [hiddenIds, setHiddenIds] = useState(() => new Set())
  const turn = useMutation(sendTutorTurn, { onError: (error) => notifyError(toast, error, { form: true }) })
  const remove = useMutation(deleteTutorSession, { onError: (error) => notifyError(toast, error) })
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [messages.length, turn.loading])

  const send = async (body, studentText) => {
    const result = await turn.mutate(body)
    if (!result.ok) {
      if (result.error?.fieldErrors?.session_id) setSession((current) => current && { ...current, status: 'completed' })
      return false
    }
    const payload = result.data ?? {}
    const data = payload.data ?? {}
    const reply = normalizeTutorReply(data.reply)
    const replyText = data.reply?.text ?? data.reply?.explanation ?? ''
    if (!payload.available || !data.session || (!replyText && !reply.quiz && !reply.diagram_mermaid)) {
      toast.warning(payload.message || payload.reason || 'El tutor no está disponible en este momento. Inténtalo en unos minutos.')
      return false
    }
    setSession(data.session)
    setMessages((current) => [...current, bubble('student', studentText), bubble('tutor', replyText, data.reply)])
    history.reload()
    return true
  }

  const start = (body) => {
    setMessages([])
    return send(buildTutorStartBody(body), body.topic)
  }

  useEffect(() => {
    if (!seed || startedRef.current) return
    startedRef.current = true
    setSearchParams({}, { replace: true })
    void start(seed).finally(() => setPreloaded(true))
    // El seed se consume una sola vez al montar (paso 5 → tutor).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const open = (row) => {
    turn.reset()
    setSession(row)
    setMessages(toBubbles(row.messages))
    setPanel(row.article?.published ? 'article' : 'chat')
  }

  const restart = () => {
    turn.reset()
    seedRef.current = null
    setPreloaded(true)
    setSession(null)
    setMessages([])
    setPanel('chat')
  }

  const confirmDelete = async () => {
    const target = pendingDelete
    if (!target) return
    const result = await remove.mutate(target.id)
    if (!result.ok) return
    toast.success('Sesión eliminada.')
    setHiddenIds((current) => new Set(current).add(target.id))
    setPendingDelete(null)
    if (session?.id === target.id) restart()
    history.reload()
  }

  const lastArticleSuggestion = [...messages].reverse().find((message) => message.role === 'tutor' && message.type === 'article')

  const lastTutor = [...messages].reverse().find((message) => message.role === 'tutor')
  const active = session?.status === 'active'
  const waitingPreload = Boolean(seed) && !preloaded && !session

  return (
    <div className="space-y-4" data-cy="ia-tutor">
      <PageHeader title="IA Tutor" description="Refuerzo académico guiado con metodología C.R.E.A.T.E.: pistas, diagramas, autoevaluación y redacción de artículos." />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
          {session ? (
            <>
              <header className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-navy-950">{session.topic}</h2>
                  <p className="text-xs text-slate-500">
                    {[session.course_name, session.criterion ? `Criterio ${session.criterion}` : null, active && session.hint_level ? `Pista ${session.hint_level} de ${MAX_HINTS}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge map={TUTOR_STATUS} value={session.status} />
                  <button type="button" className={secondaryButton} onClick={restart}>
                    Nueva sesión
                  </button>
                </div>
              </header>

              <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Paneles del IA Tutor">
                <button
                  type="button"
                  role="tab"
                  aria-selected={panel === 'chat'}
                  className={`${panel === 'chat' ? primaryButton : secondaryButton} !h-9`}
                  onClick={() => setPanel('chat')}
                >
                  <MessageSquareText size={16} />
                  Conversación
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={panel === 'article'}
                  data-cy="article-panel-tab"
                  className={`${panel === 'article' ? primaryButton : secondaryButton} !h-9`}
                  onClick={() => setPanel('article')}
                >
                  <Newspaper size={16} />
                  Redactar y Publicar Artículo
                </button>
              </div>

              {panel === 'article' ? (
                <div className="mt-4">
                  <ArticleStudio
                    key={`${session.id}-${session.article?.published_at || 'draft'}`}
                    session={session}
                    suggestion={lastArticleSuggestion?.explanation || lastArticleSuggestion?.content || ''}
                    loading={turn.loading}
                    errors={turn.fieldErrors}
                    onAssist={(body) => send(body, body.message)}
                    onPublish={(body) => send(body, body.message).then((ok) => ok && setPanel('article'))}
                  />
                </div>
              ) : (
                <>
                  <div className="mt-3">
                    <CreatePhaseBar phase={createPhaseOf(session, lastTutor)} />
                  </div>

                  <ol aria-live="polite" className="my-4 max-h-[55svh] min-h-48 space-y-3 overflow-y-auto pr-1">
                    {messages.map((message, index) => (
                      <TutorBubble
                        key={message.key}
                        message={message}
                        interactive={active && index === messages.length - 1 && message.role === 'tutor'}
                        disabled={turn.loading}
                        onSelect={(option) => send({ session_id: session.id, option_id: option.id }, option.text)}
                      />
                    ))}
                    {turn.loading ? (
                      <li className="flex gap-2">
                        <TutorLoading label="El tutor está elaborando la respuesta…" />
                      </li>
                    ) : null}
                    <li ref={endRef} aria-hidden="true" />
                  </ol>

                  {active ? (
                    <div className="space-y-3">
                      {quizFromMessage(lastTutor) ? null : (
                        <Composer
                          key={`${session.id}-${messages.length}`}
                          errors={turn.fieldErrors}
                          loading={turn.loading}
                          onMessage={(text) => send({ session_id: session.id, message: text }, text)}
                        />
                      )}
                      <HintActions
                        disabled={turn.loading}
                        onIntent={(intent) => send(buildTutorIntentBody(session.id, intent.message), intent.message)}
                      />
                    </div>
                  ) : (
                    <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      {session.status === 'no_catalog'
                        ? 'Aún no hay una guía curada para este tema. Prueba con otro (por ejemplo, funciones lineales).'
                        : 'Esta sesión terminó. Revisa tus notas de reflexión o inicia una nueva sesión.'}
                    </p>
                  )}
                </>
              )}
            </>
          ) : waitingPreload || turn.loading || (summaryLoading && !summary) ? (
            <TutorLoading
              label={
                turn.loading
                  ? 'El tutor está elaborando la respuesta…'
                  : waitingPreload
                    ? 'Iniciando la sesión C.R.E.A.T.E.…'
                    : 'Cargando tus cursos…'
              }
            />
          ) : summaryError && !summary ? (
            <LoadError onRetry={reloadSummary} />
          ) : (
            <StartForm courses={summary?.courses ?? []} errors={turn.fieldErrors} loading={turn.loading} onStart={start} initial={seed} />
          )}
        </section>

        <SessionHistory
          list={history}
          activeId={session?.id}
          hiddenIds={hiddenIds}
          onOpen={open}
          onDelete={setPendingDelete}
        />
      </div>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="¿Eliminar esta sesión?"
        message={
          pendingDelete ? (
            <>
              <p>
                Se borrará el historial de «{pendingDelete.topic}» y el borrador de artículo asociado.
              </p>
              <p className="mt-1 text-xs text-slate-500">Esta acción no se puede deshacer.</p>
            </>
          ) : null
        }
        confirmLabel="Eliminar"
        danger
        loading={remove.loading}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
