import { useEffect, useRef, useState } from 'react'
import { Bot, History, Send, Sparkles } from 'lucide-react'
import { fetchTutorSessions, sendTutorTurn } from '../../api/student'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import Skeleton, { SkeletonList } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { useMutation } from '../../hooks/useApi'
import { notifyError, toId, usePagedList } from '../admin/shared/hooks'
import { LoadError, PageHeader, primaryButton, secondaryButton } from '../admin/shared/ui'
import { StatusBadge, formatDateTime } from '../residencia/shared'
import { TUTOR_STATUS, useMySummary } from './shared'

const MAX_HINTS = 3

const toBubbles = (messages = []) =>
  messages.map((message) => ({ key: `m-${message.id}`, role: message.role, content: message.content, options: message.options ?? [] }))

let localKey = 0
const bubble = (role, content, options = []) => ({ key: `l-${++localKey}`, role, content, options })

function Bubble({ role, content }) {
  const isTutor = role === 'tutor'
  return (
    <li className={`flex gap-2 ${isTutor ? '' : 'justify-end'}`}>
      {isTutor ? (
        <span className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 min-[400px]:flex">
          <Bot size={16} />
        </span>
      ) : null}
      <p
        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm sm:max-w-[75%] ${
          isTutor ? 'rounded-tl-sm bg-slate-100 text-slate-800' : 'rounded-tr-sm bg-navy-900 text-white'
        }`}
      >
        {content}
      </p>
    </li>
  )
}

function StartForm({ courses, errors, loading, onStart }) {
  const [courseId, setCourseId] = useState(null)
  const [topic, setTopic] = useState('')

  if (!courses.length) {
    return <EmptyState icon={Sparkles} title="No tienes cursos matriculados en el periodo vigente." />
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onStart({ course_id: courseId, topic: topic.trim() })
      }}
    >
      <p className="text-sm text-slate-600">
        Elige el curso y escribe el tema que quieres reforzar. El tutor te guiará con preguntas y pistas; no te dará la respuesta final.
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
      <button type="submit" className={`${primaryButton} w-full sm:w-auto`} disabled={loading}>
        <Sparkles size={16} />
        {loading ? 'Iniciando…' : 'Comenzar sesión'}
      </button>
    </form>
  )
}

function Composer({ options, errors, loading, onOption, onMessage }) {
  const [draft, setDraft] = useState('')

  if (options.length) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={loading}
            onClick={() => onOption(option)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 hover:border-teal-400 hover:bg-teal-50 disabled:opacity-60"
          >
            <span className="mr-2 font-semibold uppercase text-teal-700">{option.id})</span>
            {option.text}
          </button>
        ))}
      </div>
    )
  }

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

function SessionHistory({ list, activeId, onOpen }) {
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
      ) : list.rows.length ? (
        <ul className="space-y-2">
          {list.rows.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => onOpen(session)}
                aria-current={session.id === activeId ? 'true' : undefined}
                className={`w-full rounded-xl border px-3 py-2.5 text-left hover:border-teal-400 ${
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
  const toast = useToast()
  const { summary, loading: summaryLoading, error: summaryError, reload: reloadSummary } = useMySummary()
  const history = usePagedList(fetchTutorSessions)
  const [session, setSession] = useState(null)
  const [messages, setMessages] = useState([])
  const turn = useMutation(sendTutorTurn, { onError: (error) => notifyError(toast, error, { form: true }) })
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
    const { available, data } = result.data
    if (!available) {
      toast.warning('El tutor no está disponible en este momento. Inténtalo en unos minutos.')
      return false
    }
    setSession(data.session)
    setMessages((current) => [...current, bubble('student', studentText), bubble('tutor', data.reply.text, data.reply.options ?? [])])
    history.reload()
    return true
  }

  const start = (body) => {
    setMessages([])
    return send(body, body.topic)
  }

  const open = (row) => {
    turn.reset()
    setSession(row)
    setMessages(toBubbles(row.messages))
  }

  const restart = () => {
    turn.reset()
    setSession(null)
    setMessages([])
  }

  const lastTutor = [...messages].reverse().find((message) => message.role === 'tutor')
  const active = session?.status === 'active'

  return (
    <div className="space-y-4">
      <PageHeader title="IA Tutor" description="Refuerzo académico guiado: diagnóstico, pistas graduales, verificación y reflexión." />

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

              <ol aria-live="polite" className="my-4 max-h-[55svh] min-h-48 space-y-3 overflow-y-auto pr-1">
                {messages.map((message) => (
                  <Bubble key={message.key} role={message.role} content={message.content} />
                ))}
                {turn.loading ? (
                  <li className="flex gap-2">
                    <Skeleton className="h-10 w-2/3 rounded-2xl" />
                  </li>
                ) : null}
                <li ref={endRef} aria-hidden="true" />
              </ol>

              {active ? (
                <Composer
                  key={`${session.id}-${messages.length}`}
                  options={lastTutor?.options ?? []}
                  errors={turn.fieldErrors}
                  loading={turn.loading}
                  onOption={(option) => send({ session_id: session.id, option_id: option.id }, option.text)}
                  onMessage={(text) => send({ session_id: session.id, message: text }, text)}
                />
              ) : (
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Esta sesión terminó. Revisa tus notas de reflexión o inicia una nueva sesión.
                </p>
              )}
            </>
          ) : summaryLoading && !summary ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-40" />
            </div>
          ) : summaryError && !summary ? (
            <LoadError onRetry={reloadSummary} />
          ) : (
            <StartForm courses={summary?.courses ?? []} errors={turn.fieldErrors} loading={turn.loading} onStart={start} />
          )}
        </section>

        <SessionHistory list={history} activeId={session?.id} onOpen={open} />
      </div>
    </div>
  )
}
