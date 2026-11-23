/** Escala oficial Minedu (TOBE-4): vigesimal 0.00–20.00 ↔ literal AD/A/B/C. */
export const MIN_SCORE = 0
export const MAX_SCORE = 20
export const PASSING_SCORE = 11

export const LETTER_META = {
  AD: { letter: 'AD', min: 18, name: 'Logro destacado', badge: 'normal' },
  A: { letter: 'A', min: 15, name: 'Logro esperado', badge: 'pendiente_apoderado' },
  B: { letter: 'B', min: 11, name: 'En proceso', badge: 'observado' },
  C: { letter: 'C', min: 0, name: 'En inicio', badge: 'critico' },
}

export function parseScore(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const value = Number(String(raw).trim().replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

export function normalizeScore(raw) {
  const value = parseScore(raw)
  if (value === null) return null
  return Math.round(value * 100) / 100
}

export function isValidScore(raw) {
  const value = parseScore(raw)
  return value !== null && value >= MIN_SCORE && value <= MAX_SCORE
}

/** 18–20 AD · 15–17.99 A · 11–14.99 B · 0–10.99 C. Fuera de rango o vacío: null. */
export function toLiteral(score) {
  const value = parseScore(score)
  if (value === null || value < MIN_SCORE || value > MAX_SCORE) return null
  if (value >= LETTER_META.AD.min) return 'AD'
  if (value >= LETTER_META.A.min) return 'A'
  if (value >= LETTER_META.B.min) return 'B'
  return 'C'
}

export function letterBadge(literal) {
  return LETTER_META[literal]?.badge ?? 'observado'
}

export function formatScore(value) {
  const parsed = parseScore(value)
  if (parsed === null) return '—'
  return String(Number(parsed.toFixed(2)))
}

export function formatScoreWithLiteral(value, literal) {
  const score = formatScore(value)
  if (score === '—') return score
  const letter = literal || toLiteral(value)
  return letter ? `${score} (${letter})` : score
}
