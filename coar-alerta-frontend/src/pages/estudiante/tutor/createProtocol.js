export const CREATE_PHASES = [
  { id: 'conectar', label: 'Conectar', short: 'Conexión' },
  { id: 'recordar', label: 'Recordar', short: 'Recuerdo' },
  { id: 'explicar', label: 'Explicar', short: 'Explicación' },
  { id: 'aplicar', label: 'Aplicar', short: 'Aplicación' },
  { id: 'transferir', label: 'Transferir', short: 'Transferencia' },
  { id: 'evaluar', label: 'Evaluar', short: 'Verificación' },
]

export const CREATE_WRITING_GUIDES = [
  { id: 'conectar', label: 'Conectar', prompt: 'Escribe un gancho que una el tema con tu experiencia, un problema real o una noticia.' },
  { id: 'recordar', label: 'Recordar', prompt: 'Lista los conceptos, definiciones y vocabulario que el lector debe tener presentes.' },
  { id: 'explicar', label: 'Explicar', prompt: 'Desarrolla la idea central con tus palabras: causa, proceso y consecuencia.' },
  { id: 'aplicar', label: 'Aplicar', prompt: 'Incluye un ejemplo, caso o ejercicio resuelto que demuestre el concepto.' },
  { id: 'transferir', label: 'Transferir', prompt: 'Lleva la idea a otro contexto: otra materia, tu comunidad o un problema nuevo.' },
  { id: 'evaluar', label: 'Evaluar', prompt: 'Cierra con una autoevaluación honesta y las fuentes citadas (autor, año, título).' },
]

export const ARTICLE_ACTIONS = {
  cowrite: { id: 'cowrite', label: 'Co-escribir', tag: '[ARTICLE_COWRITE]', hint: 'La IA propone el siguiente párrafo en tu estilo.' },
  proofread: { id: 'proofread', label: 'Revisar ortografía', tag: '[ARTICLE_PROOFREAD]', hint: 'Corrige tildes y claridad sin borrar tu voz.' },
  synth: { id: 'synth', label: 'Sintetizar', tag: '[ARTICLE_SYNTH]', hint: 'Resume el borrador en ideas clave.' },
  cite: { id: 'cite', label: 'Citar fuentes', tag: '[ARTICLE_CITE]', hint: 'Sugiere citas académicas a partir de tu texto.' },
}

const MAX_ARTICLE_MESSAGE = 4000

export function writingGuide(phaseId) {
  return CREATE_WRITING_GUIDES.find((item) => item.id === phaseId) ?? CREATE_WRITING_GUIDES[0]
}

export function articleFromSession(session) {
  const article = session?.article
  if (!article || typeof article !== 'object') return null
  return {
    title: String(article.title ?? ''),
    body: String(article.body ?? ''),
    create_phase: article.create_phase ?? null,
    published: Boolean(article.published),
    published_at: article.published_at ?? null,
  }
}

export function buildArticleMessage(tag, { title, body, phase }) {
  const header = `${tag}\nFase: ${phase || 'conectar'}\nTítulo: ${String(title || '').trim()}\n---\n`
  const budget = Math.max(0, MAX_ARTICLE_MESSAGE - header.length)
  return header + String(body || '').slice(0, budget)
}

export function buildArticleAssistBody(sessionId, action, draft) {
  return { session_id: sessionId, message: buildArticleMessage(action.tag, draft) }
}

export function buildArticlePublishBody(sessionId, draft) {
  return { session_id: sessionId, message: buildArticleMessage('[ARTICLE_PUBLISH]', draft) }
}

export const TUTOR_INTENTS = {
  hint: {
    id: 'hint',
    label: 'Pedir pista',
    message: '[HINT] Dame una pista sin la respuesta final',
  },
  diagram: {
    id: 'diagram',
    label: 'Ver diagrama',
    message: '[DIAGRAM_MERMAID] Muéstrame un diagrama del concepto',
  },
  quiz: {
    id: 'quiz',
    label: 'Autoevaluación',
    message: '[QUIZ] Hazme una pregunta de comprobación',
  },
}

const STEP_TO_CREATE = {
  diagnostico: 'conectar',
  pregunta_guia: 'recordar',
  pista: 'explicar',
  verificacion: 'aplicar',
  reflexion: 'transferir',
  finalizado: 'evaluar',
}

export function createPhaseOf(session, message) {
  return message?.create_phase || session?.create_phase || STEP_TO_CREATE[session?.step] || null
}

export function phaseMeta(phaseId) {
  return CREATE_PHASES.find((phase) => phase.id === phaseId) ?? null
}

export function displayStudentText(text) {
  const raw = String(text || '').trim()
  const upper = raw.toUpperCase()
  if (upper.startsWith('[HINT]') || upper.startsWith('[PISTA]')) return TUTOR_INTENTS.hint.label
  if (upper.startsWith('[DIAGRAM')) return TUTOR_INTENTS.diagram.label
  if (upper.startsWith('[QUIZ]')) return TUTOR_INTENTS.quiz.label
  if (upper.startsWith('[ARTICLE_PUBLISH]')) return 'Publicar artículo'
  if (upper.startsWith('[ARTICLE_PROOFREAD]')) return ARTICLE_ACTIONS.proofread.label
  if (upper.startsWith('[ARTICLE_SYNTH]')) return ARTICLE_ACTIONS.synth.label
  if (upper.startsWith('[ARTICLE_CITE]')) return ARTICLE_ACTIONS.cite.label
  if (upper.startsWith('[ARTICLE_COWRITE]') || upper.startsWith('[ARTICLE]')) return ARTICLE_ACTIONS.cowrite.label
  return raw
}

export function stripMermaidFences(text) {
  return String(text || '')
    .replace(/```mermaid[\s\S]*?```/gi, '')
    .replace(/\[DIAGRAM_MERMAID\][\s\S]*?(\[\/DIAGRAM_MERMAID\]|$)/gi, '')
    .replace(/\[QUIZ\][\s\S]*?(\[\/QUIZ\]|$)/gi, '')
    .replace(/\[RECURSO_VISUAL\][\s\S]*?(\[\/RECURSO_VISUAL\]|$)/gi, '')
    .replace(/\[FASE\]\s*:?\s*\S+/gi, '')
    .trim()
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

/** `quiz` / `autoevaluacion` vacíos, nulos o sin opciones no deben romper el render. */
export function asTutorQuiz(value) {
  const quiz = asObject(value)
  if (!quiz) return null
  const options = Array.isArray(quiz.options)
    ? quiz.options.filter((option) => option?.id != null && option.id !== '' && String(option.text ?? '').trim())
    : []
  if (!options.length) return null
  return { question: quiz.question ?? quiz.pregunta ?? null, options }
}

/** `diagram_mermaid` / `diagrama` vacíos, nulos u objeto incompleto se omiten. */
export function asTutorDiagram(value) {
  if (typeof value === 'string') return value.trim() || null
  const object = asObject(value)
  if (!object) return null
  return asTutorDiagram(object.mermaid ?? object.chart ?? object.source ?? object.diagrama ?? '')
}

/** Normaliza el `reply` del tutor aunque Gemini omita o aliaste campos. */
export function normalizeTutorReply(reply) {
  const source = asObject(reply) ?? {}
  return {
    type: source.type ?? null,
    options: Array.isArray(source.options) ? source.options : [],
    create_phase: source.create_phase ?? null,
    explanation: source.explanation ?? null,
    reflection: source.reflection ?? null,
    quiz: asTutorQuiz(source.quiz ?? source.autoevaluacion),
    diagram_mermaid: asTutorDiagram(source.diagram_mermaid ?? source.diagrama),
    visual_resource: source.visual_resource ?? null,
  }
}

export function quizFromMessage(message) {
  const quiz = asTutorQuiz(message?.quiz ?? message?.autoevaluacion)
  if (quiz) return quiz
  if (message?.options?.length) {
    return { question: message?.explanation || message?.content, options: message.options }
  }
  return null
}
