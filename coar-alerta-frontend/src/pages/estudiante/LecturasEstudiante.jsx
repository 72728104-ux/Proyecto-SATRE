import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Sparkles } from 'lucide-react'
import {
  fetchReadingArtifacts,
  fetchReadingQuestions,
  fetchReadingQuizAttempts,
  fetchReadings,
  submitGuidedResponse,
  submitReadingArtifact,
  submitReadingQuiz,
  tutorPathFromReading,
} from '../../api/student'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Pagination from '../../components/Pagination'
import Skeleton from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { useMutation } from '../../hooks/useApi'
import { notifyError, usePagedList } from '../admin/shared/hooks'
import { FilterBar, LoadError, PageHeader, primaryButton, secondaryButton } from '../admin/shared/ui'
import { useMySummary } from './shared'

const STEPS = [
  { id: 1, label: '1. Leer' },
  { id: 2, label: '2. Mapa' },
  { id: 3, label: '3. Preguntas' },
  { id: 4, label: '4. Quiz' },
]

function optionChoices(question) {
  return (question.options ?? []).map((option, index) => {
    if (typeof option === 'string') return { id: option, text: option }
    return { id: String(option.id ?? String.fromCharCode(65 + index)), text: option.text ?? option.id ?? '' }
  })
}

function parseMap(nodesText, linksText) {
  const nodes = nodesText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label, index) => ({ id: `n${index + 1}`, label }))
  const byLabel = Object.fromEntries(nodes.map((node) => [node.label.toLowerCase(), node.id]))
  const connections = linksText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [fromRaw, toRaw] = line.split(/\s*(?:→|->)\s*/)
      return { from: byLabel[fromRaw?.toLowerCase()] ?? fromRaw, to: byLabel[toRaw?.toLowerCase()] ?? toRaw }
    })
  return { nodes, connections }
}

function StepNav({ step, onChange }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {STEPS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded-full px-3 py-1.5 text-sm ${
            step === item.id ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}

function TutorNextStep({ reading }) {
  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-4" data-cy="paso-5-tutor">
      <p className="text-sm text-teal-950">
        Paso 5: propone una pregunta o experimento nuevo a partir de lo leído. El tutor te guía con pistas; no te da la
        respuesta final.
      </p>
      <Link to={tutorPathFromReading(reading)} className={`${primaryButton} mt-3`} data-cy="profundizar-ia-tutor">
        <Sparkles size={16} />
        Profundizar con IA Tutor
      </Link>
    </div>
  )
}

function ArtifactStep({ reading, list }) {
  const toast = useToast()
  const [nodesText, setNodesText] = useState('')
  const [linksText, setLinksText] = useState('')
  const save = useMutation((body) => submitReadingArtifact(reading.id, body), {
    onError: (error) => notifyError(toast, error, { form: true }),
  })
  const mine = list.rows[0]

  const submit = async (e) => {
    e.preventDefault()
    const result = await save.mutate(parseMap(nodesText, linksText))
    if (result.ok) {
      toast.success('Mapa guardado. Tu docente lo revisará de forma cualitativa.')
      list.reload()
    }
  }

  return (
    <form noValidate className="space-y-4" onSubmit={submit}>
      <p className="text-sm text-slate-600">
        Resume el artículo con nodos y conexiones. No hay calificación automática: solo se valida que el mapa no esté
        vacío.
      </p>
      {mine ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Ya enviaste un mapa con {mine.nodes?.length ?? 0} nodos y {mine.connections?.length ?? 0} conexiones.
        </p>
      ) : null}
      <Field as="textarea" rows={4} label="Nodos (uno por línea)" name="nodes" required value={nodesText} onChange={(e) => setNodesText(e.target.value)} error={save.fieldErrors.nodes} />
      <Field
        as="textarea"
        rows={3}
        label="Conexiones (origen → destino, una por línea)"
        name="connections"
        required
        value={linksText}
        onChange={(e) => setLinksText(e.target.value)}
        error={save.fieldErrors.connections}
      />
      <button type="submit" className={primaryButton} disabled={save.loading}>
        {save.loading ? 'Guardando…' : 'Guardar mapa'}
      </button>
    </form>
  )
}

function QuestionsStep({ reading, list }) {
  const toast = useToast()
  const [drafts, setDrafts] = useState({})
  const save = useMutation((body) => submitGuidedResponse(reading.id, body), {
    onError: (error) => notifyError(toast, error, { form: true }),
  })

  const answer = async (question) => {
    const response = (drafts[question.id] ?? '').trim()
    const result = await save.mutate({ guided_question_id: question.id, response })
    if (result.ok) {
      toast.success(result.data?.data?.feedback ?? (result.data?.data?.is_correct ? 'Correcto.' : 'Respuesta registrada.'))
      list.reload()
    }
  }

  if (list.error && !list.data) return <LoadError onRetry={list.reload} />
  if (!list.loading && !list.rows.length) {
    return <EmptyState icon={BookOpen} title="Aún no hay preguntas guía para esta lectura." />
  }

  return (
    <ul className="space-y-4">
      {list.rows.map((question) => {
        const choices = optionChoices(question)
        const mine = question.my_response
        return (
          <li key={question.id} className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-medium text-navy-950">{question.prompt}</p>
            {mine ? (
              <p className={`mt-2 text-sm ${mine.is_correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                Tu respuesta: {mine.response}
              </p>
            ) : question.type === 'multiple_choice' && choices.length ? (
              <div className="mt-3 grid gap-2">
                {choices.map((choice) => (
                  <label key={choice.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name={`q-${question.id}`}
                      value={choice.id}
                      checked={drafts[question.id] === choice.id}
                      onChange={() => setDrafts((current) => ({ ...current, [question.id]: choice.id }))}
                    />
                    {choice.text}
                  </label>
                ))}
              </div>
            ) : (
              <Field
                className="mt-3"
                label="Tu respuesta"
                name={`response-${question.id}`}
                value={drafts[question.id] ?? ''}
                onChange={(e) => setDrafts((current) => ({ ...current, [question.id]: e.target.value }))}
              />
            )}
            {!mine ? (
              <button type="button" className={`${primaryButton} mt-3`} disabled={save.loading || !(drafts[question.id] ?? '').trim()} onClick={() => answer(question)}>
                Enviar
              </button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function QuizStep({ reading, questions, attempts }) {
  const toast = useToast()
  const [answers, setAnswers] = useState({})
  const save = useMutation((body) => submitReadingQuiz(reading.id, body), {
    onError: (error) => notifyError(toast, error, { form: true }),
  })
  const latest = save.data?.data ?? attempts.rows[0] ?? null

  const submit = async (e) => {
    e.preventDefault()
    const payload = {
      answers: questions.rows.map((question) => ({
        guided_question_id: question.id,
        response: (answers[question.id] ?? '').trim(),
      })),
    }
    const result = await save.mutate(payload)
    if (result.ok) {
      toast.success(`Quiz enviado: ${result.data?.data?.correct_count ?? 0} de ${result.data?.data?.total_questions ?? 0} correctas.`)
      attempts.reload()
    }
  }

  if (questions.loading && !questions.data) return <Skeleton className="h-40 rounded-xl" />
  if (questions.error && !questions.data) return <LoadError onRetry={questions.reload} />
  if (!questions.loading && !questions.rows.length) {
    return <EmptyState icon={BookOpen} title="No hay preguntas para armar el quiz." />
  }

  return (
    <form noValidate className="space-y-4" onSubmit={submit} data-cy="quiz-lectura">
      {questions.rows.map((question) => {
        const choices = optionChoices(question)
        return (
          <fieldset key={question.id} className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-medium text-navy-950">{question.prompt}</legend>
            {question.type === 'multiple_choice' && choices.length ? (
              <div className="mt-2 grid gap-2">
                {choices.map((choice) => (
                  <label key={choice.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name={`quiz-${question.id}`}
                      value={choice.id}
                      checked={answers[question.id] === choice.id}
                      onChange={() => setAnswers((current) => ({ ...current, [question.id]: choice.id }))}
                    />
                    {choice.text}
                  </label>
                ))}
              </div>
            ) : (
              <Field
                className="mt-2"
                label="Tu respuesta"
                name={`quiz-response-${question.id}`}
                value={answers[question.id] ?? ''}
                onChange={(e) => setAnswers((current) => ({ ...current, [question.id]: e.target.value }))}
              />
            )}
          </fieldset>
        )
      })}
      <button type="submit" className={primaryButton} disabled={save.loading || !questions.rows.length}>
        {save.loading ? 'Enviando…' : 'Enviar quiz'}
      </button>

      {latest ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Resultado: <span className="font-semibold text-navy-950">{latest.correct_count}/{latest.total_questions}</span>
            {latest.score != null ? ` · ${latest.score}%` : null}
          </p>
          {(latest.results ?? []).map((item) => (
            <p key={item.guided_question_id} className={`text-sm ${item.is_correct ? 'text-emerald-700' : 'text-rose-700'}`}>
              {item.feedback}
            </p>
          ))}
          <TutorNextStep reading={reading} />
        </div>
      ) : null}
    </form>
  )
}

function ReadingFlow({ reading, onBack }) {
  const [step, setStep] = useState(1)
  const artifacts = usePagedList((params, options) => fetchReadingArtifacts(reading.id, params, options))
  const questions = usePagedList((params, options) => fetchReadingQuestions(reading.id, params, options))
  const attempts = usePagedList((params, options) => fetchReadingQuizAttempts(reading.id, params, options))

  return (
    <div className="space-y-4" data-cy="lectura-detalle">
      <button type="button" className={secondaryButton} onClick={onBack}>
        <ArrowLeft size={16} />
        Volver a lecturas
      </button>
      <PageHeader
        title={reading.title}
        description={[reading.course_name, reading.criterion ? `Criterio ${reading.criterion}` : null].filter(Boolean).join(' · ')}
      />
      <StepNav step={step} onChange={setStep} />

      {step === 1 ? (
        <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {reading.url ? (
            <a href={reading.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-teal-700 hover:text-teal-900">
              Abrir recurso
            </a>
          ) : null}
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{reading.content || 'Esta lectura no tiene texto adjunto.'}</p>
        </article>
      ) : null}
      {step === 2 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <ArtifactStep reading={reading} list={artifacts} />
        </section>
      ) : null}
      {step === 3 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <QuestionsStep reading={reading} list={questions} />
          <Pagination meta={questions.meta} onPageChange={questions.setPage} disabled={questions.loading} />
        </section>
      ) : null}
      {step === 4 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <QuizStep reading={reading} questions={questions} attempts={attempts} />
        </section>
      ) : null}
    </div>
  )
}

export default function LecturasEstudiante() {
  const { summary } = useMySummary()
  const list = usePagedList(fetchReadings, { course_id: '' })
  const [selected, setSelected] = useState(null)

  if (selected) return <ReadingFlow reading={selected} onBack={() => setSelected(null)} />

  return (
    <div className="space-y-4" data-cy="lecturas-estudiante">
      <PageHeader title="Lecturas CREATE-SATRE" description="Lee el tema, arma tu mapa, responde las preguntas guía y el quiz. Al terminar puedes profundizar con el tutor socrático." />

      <FilterBar>
        <Field as="select" label="Curso" name="filter_course" value={list.filters.course_id} onChange={(e) => list.setFilter('course_id', e.target.value)}>
          <option value="">Todos</option>
          {(summary?.courses ?? []).map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </Field>
      </FilterBar>

      {list.error && !list.data ? (
        <LoadError onRetry={list.reload} />
      ) : (
        <DataTable
          loading={list.loading && !list.data}
          empty={<EmptyState icon={BookOpen} title="No hay lecturas asignadas en tus cursos." />}
          columns={[
            { key: 'title', header: 'Tema', primary: true },
            { key: 'course_name', header: 'Curso' },
            { key: 'criterion', header: 'Criterio', render: (row) => (row.criterion ? `IB ${row.criterion}` : '—') },
            {
              key: 'open',
              header: '',
              render: (row) => (
                <button type="button" className="text-sm font-medium text-teal-700 hover:text-teal-900" onClick={() => setSelected(row)}>
                  Abrir
                </button>
              ),
            },
          ]}
          rows={list.rows}
        />
      )}
      <Pagination meta={list.meta} onPageChange={list.setPage} disabled={list.loading} />
    </div>
  )
}
