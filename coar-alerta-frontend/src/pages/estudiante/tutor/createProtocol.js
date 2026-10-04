export const CREATE_PHASES = [
  { id: 'conectar', label: 'Conectar', short: 'Conexión' },
  { id: 'recordar', label: 'Recordar', short: 'Recuerdo' },
  { id: 'explicar', label: 'Explicar', short: 'Explicación' },
  { id: 'aplicar', label: 'Aplicar', short: 'Aplicación' },
  { id: 'transferir', label: 'Transferir', short: 'Transferencia' },
  { id: 'evaluar', label: 'Evaluar', short: 'Verificación' },
]

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

export function quizFromMessage(message) {
  if (message?.quiz?.options?.length) return message.quiz
  if (message?.options?.length) {
    return { question: message.explanation || message.content, options: message.options }
  }
  return null
}
