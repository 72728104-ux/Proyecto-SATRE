const DEFAULT_API_URL = 'http://localhost:8000/api'

function normalizeApiBase(raw) {
  const fallback = DEFAULT_API_URL
  const value = String(raw ?? fallback).trim().replace(/\/+$/, '')
  try {
    const url = new URL(value)
    if (url.pathname === '' || url.pathname === '/') url.pathname = '/api'
    return url.toString().replace(/\/+$/, '')
  } catch {
    return fallback
  }
}

/** Base Laravel (`/api`). Acepta `VITE_API_URL` con o sin el prefijo. */
export const API_URL = normalizeApiBase(import.meta.env.VITE_API_URL)

/** Une base + path sin duplicar `/api` (`/api/auth/login` vs `/auth/login`). */
export function buildApiUrl(path) {
  const raw = path.startsWith('/') ? path : `/${path}`
  const relative = API_URL.endsWith('/api') && (raw === '/api' || raw.startsWith('/api/')) ? raw.slice(4) || '/' : raw
  return `${API_URL}${relative}`
}

const INTERNAL_KEY = import.meta.env.VITE_INTERNAL_KEY || 'clave_secreta_super_segura_de_mas_de_32_caracteres_12345'
const DEFAULT_TIMEOUT_MS = 15000

export const STORAGE_PREFIX = 'coar.satre.'
const TOKEN_KEY = `${STORAGE_PREFIX}token`

const listeners = new Set()

/**
 * Eventos globales: unauthorized, password_change_required, forbidden, rate_limited, network, timeout.
 * Devuelve la función para desuscribirse.
 */
export function subscribeApiEvents(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const emit = (event) => listeners.forEach((listener) => listener(event))

export class ApiError extends Error {
  constructor(message, { status = 0, kind = 'http', payload = {}, fieldErrors = {}, retryAfter = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.kind = kind
    this.payload = payload
    this.errors = payload?.errors ?? {}
    this.fieldErrors = fieldErrors
    this.retryAfter = retryAfter
  }
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  else sessionStorage.removeItem(TOKEN_KEY)
}

export function clearStoredSession() {
  for (const storage of [sessionStorage, localStorage]) {
    Object.keys(storage)
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .forEach((key) => storage.removeItem(key))
  }
}

/**
 * Opciones: `silent` evita los toasts globales (403/429/red); `skipAuthHandling` evita el logout automático en 401.
 * `responseType: 'blob'` devuelve `{ blob, filename }` para descargas (los errores siguen llegando como JSON).
 */
export async function apiRequest(
  path,
  {
    method = 'GET',
    body,
    token,
    signal,
    timeout = DEFAULT_TIMEOUT_MS,
    silent = false,
    skipAuthHandling = false,
    responseType = 'json',
  } = {},
) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const headers = {
    Accept: 'application/json',
    'X-Internal-Key': INTERNAL_KEY,
  }
  if (body && !isFormData) headers['Content-Type'] = 'application/json'

  const authToken = token ?? getToken()
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeout)
  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort, { once: true })

  let response
  try {
    response = await fetch(buildApiUrl(path), {
      method,
      headers,
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    })
  } catch {
    if (signal?.aborted && !timedOut) throw new ApiError('Solicitud cancelada.', { kind: 'aborted' })
    const error = timedOut
      ? new ApiError('El servidor tardó demasiado en responder. Inténtalo nuevamente.', { kind: 'timeout' })
      : new ApiError('No hay conexión con el servidor. Verifica tu red e inténtalo nuevamente.', { kind: 'network' })
    if (!silent) emit({ type: error.kind, error })
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }

  if (response.ok && responseType === 'blob') {
    return { blob: await response.blob(), filename: filenameFromDisposition(response.headers.get('Content-Disposition')) }
  }

  const payload = await response.json().catch(() => ({}))
  if (response.ok) return payload

  const { status } = response
  const retryAfter = status === 429 ? Number(response.headers.get('Retry-After')) || null : null
  const error = new ApiError(extractErrorMessage(payload, status, retryAfter), {
    status,
    payload,
    fieldErrors: extractFieldErrors(payload),
    retryAfter,
  })

  if (status === 401 && !skipAuthHandling) emit({ type: 'unauthorized', error })
  else if (status === 403 && payload?.must_change_password) emit({ type: 'password_change_required', error })
  else if (!silent && status === 403) emit({ type: 'forbidden', error })
  else if (!silent && status === 429) emit({ type: 'rate_limited', error })

  throw error
}

function filenameFromDisposition(header) {
  const match = header?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
  return match ? decodeURIComponent(match[1]) : null
}

export function extractFieldErrors(payload) {
  return Object.fromEntries(
    Object.entries(payload?.errors ?? {}).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages[0] : String(messages),
    ]),
  )
}

export function extractErrorMessage(payload, status, retryAfter = null) {
  if (status === 429) {
    return retryAfter
      ? `Demasiadas solicitudes. Espera ${retryAfter} s e inténtalo nuevamente.`
      : 'Demasiadas solicitudes. Espera un momento e inténtalo nuevamente.'
  }

  if (payload?.message && typeof payload.message === 'string' && !payload.errors) {
    return payload.message
  }

  if (payload?.errors) {
    return Object.values(payload.errors).flat().join(' ')
  }

  if (payload?.message) return payload.message

  if (status === 401) return 'Sesión no válida. Vuelve a iniciar sesión.'
  if (status === 403) return 'No tienes permiso para esta acción.'
  if (status === 404) return 'El recurso solicitado no existe.'
  if (status === 422) return 'Revisa los datos ingresados.'

  return 'No se pudo completar la solicitud. Inténtalo nuevamente.'
}
