import { useState } from 'react'
import { BookOpenCheck, PenLine, Quote, Sparkles, SpellCheck, WandSparkles } from 'lucide-react'
import Field from '../../../components/Field'
import { primaryButton, secondaryButton } from '../../admin/shared/ui'
import {
  ARTICLE_ACTIONS,
  CREATE_WRITING_GUIDES,
  articleFromSession,
  buildArticleAssistBody,
  buildArticlePublishBody,
  writingGuide,
} from './createProtocol'
import CreatePhaseBar from './CreatePhaseBar'

const ACTION_ICONS = {
  cowrite: WandSparkles,
  proofread: SpellCheck,
  synth: Sparkles,
  cite: Quote,
}

export default function ArticleStudio({ session, suggestion, loading, errors, onAssist, onPublish }) {
  const stored = articleFromSession(session)
  const [phase, setPhase] = useState(stored?.create_phase || session?.create_phase || 'conectar')
  const [title, setTitle] = useState(stored?.title || session?.topic || '')
  const [body, setBody] = useState(stored?.body || '')
  const guide = writingGuide(phase)
  const published = Boolean(stored?.published)
  const draft = { title, body, phase }

  return (
    <div className="space-y-4" data-cy="article-studio">
      <div className="rounded-2xl bg-gradient-to-br from-navy-950 to-navy-800 p-4 text-white sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">C.R.E.A.T.E.</p>
        <h3 className="mt-1 font-display text-2xl">Redactar y Publicar Artículo</h3>
        <p className="mt-2 text-sm text-slate-200">
          Escribe con el tutor: co-escritura, revisión, síntesis y citas. Cada fase pide un aporte tuyo, no un texto
          copiado.
        </p>
      </div>

      <CreatePhaseBar phase={phase} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CREATE_WRITING_GUIDES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPhase(item.id)}
            className={`rounded-xl border px-3 py-2 text-left text-xs font-medium ${
              item.id === phase ? 'border-teal-500 bg-teal-50 text-teal-900' : 'border-slate-200 text-slate-600 hover:border-teal-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{guide.prompt}</p>

      <Field
        label="Título"
        name="article_title"
        required
        maxLength={150}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.article_title}
      />
      <Field
        as="textarea"
        rows={10}
        label="Borrador colaborativo"
        name="article_body"
        maxLength={3500}
        placeholder="Escribe el párrafo de esta fase. Luego pide co-escritura o revisión."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        error={errors.article_body || errors.message}
      />

      <div className="flex flex-wrap gap-2" data-cy="article-actions">
        {Object.values(ARTICLE_ACTIONS).map((action) => {
          const Icon = ACTION_ICONS[action.id]
          return (
            <button
              key={action.id}
              type="button"
              disabled={loading || !title.trim()}
              title={action.hint}
              onClick={() => onAssist(buildArticleAssistBody(session.id, action, draft))}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:border-teal-400 hover:bg-teal-50 disabled:opacity-60"
            >
              <Icon size={14} />
              {action.label}
            </button>
          )
        })}
      </div>

      {suggestion ? (
        <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4" data-cy="article-suggestion">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Sugerencia de la IA</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{suggestion}</p>
          <button type="button" className={`${secondaryButton} mt-3`} onClick={() => setBody((current) => appendSuggestion(current, suggestion))}>
            <PenLine size={16} />
            Insertar en el borrador
          </button>
        </section>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className={primaryButton}
          disabled={loading || !title.trim() || !body.trim()}
          onClick={() => onPublish(buildArticlePublishBody(session.id, draft), draft)}
        >
          <BookOpenCheck size={16} />
          {loading ? 'Publicando…' : published ? 'Actualizar publicación' : 'Publicar artículo'}
        </button>
        {published ? (
          <p className="text-xs font-medium text-teal-800" data-cy="article-published">
            Publicado{stored?.published_at ? ` · ${new Date(stored.published_at).toLocaleString('es-PE')}` : ''}
          </p>
        ) : (
          <p className="text-xs text-slate-500">El artículo queda en tu sesión C.R.E.A.T.E. como evidencia de proceso.</p>
        )}
      </div>
    </div>
  )
}

function appendSuggestion(current, suggestion) {
  const next = String(suggestion || '').trim()
  if (!next) return current
  const base = String(current || '').trim()
  return base ? `${base}\n\n${next}` : next
}
