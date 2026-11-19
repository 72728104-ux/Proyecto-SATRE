import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STORAGE_PREFIX,
  ApiError,
  apiRequest,
  buildApiUrl,
  clearStoredSession,
  extractErrorMessage,
  extractFieldErrors,
  getToken,
  normalizeApiBase,
  refreshAccessToken,
  setToken,
  subscribeApiEvents,
} from './client.js'

const DEFAULT_API_URL = 'http://127.0.0.1:8000/api'

describe('normalizeApiBase', () => {
  it('usa el fallback cuando el valor es nulo o inválido', () => {
    expect(normalizeApiBase(undefined)).toBe(DEFAULT_API_URL)
    expect(normalizeApiBase(null)).toBe(DEFAULT_API_URL)
    expect(normalizeApiBase('')).toBe(DEFAULT_API_URL)
    expect(normalizeApiBase('no-es-una-url')).toBe(DEFAULT_API_URL)
  })

  it('agrega /api cuando solo llega el origen y recorta barras finales', () => {
    expect(normalizeApiBase('http://localhost:8000')).toBe('http://localhost:8000/api')
    expect(normalizeApiBase('http://localhost:8000/')).toBe('http://localhost:8000/api')
    expect(normalizeApiBase('  http://example.com/api/  ')).toBe('http://example.com/api')
  })

  it('conserva un path distinto de /api', () => {
    expect(normalizeApiBase('http://127.0.0.1:8000/v1')).toBe('http://127.0.0.1:8000/v1')
  })
})

describe('extracción de errores', () => {
  it('prioriza el mensaje 429 con y sin Retry-After', () => {
    expect(extractErrorMessage({}, 429, 12)).toBe(
      'Demasiadas solicitudes. Espera 12 s e inténtalo nuevamente.',
    )
    expect(extractErrorMessage({ message: 'ignorado' }, 429)).toBe(
      'Demasiadas solicitudes. Espera un momento e inténtalo nuevamente.',
    )
  })

  it('usa message cuando no hay errors, o aplana errors si existen', () => {
    expect(extractErrorMessage({ message: 'Credenciales inválidas' }, 422)).toBe('Credenciales inválidas')
    expect(
      extractErrorMessage(
        { message: 'Revisa', errors: { email: ['El correo es obligatorio'], password: 'Muy corta' } },
        422,
      ),
    ).toBe('El correo es obligatorio Muy corta')
  })

  it('devuelve mensajes por status cuando el payload no aporta texto', () => {
    expect(extractErrorMessage({}, 401)).toBe('Sesión no válida. Vuelve a iniciar sesión.')
    expect(extractErrorMessage({}, 403)).toBe('No tienes permiso para esta acción.')
    expect(extractErrorMessage({}, 404)).toBe('El recurso solicitado no existe.')
    expect(extractErrorMessage({}, 422)).toBe('Revisa los datos ingresados.')
    expect(extractErrorMessage({}, 500)).toBe('No se pudo completar la solicitud. Inténtalo nuevamente.')
  })

  it('deja un solo mensaje por campo en extractFieldErrors', () => {
    expect(extractFieldErrors(undefined)).toEqual({})
    expect(
      extractFieldErrors({
        errors: { email: ['Requerido', 'Formato'], password: 'Mínimo 10' },
      }),
    ).toEqual({ email: 'Requerido', password: 'Mínimo 10' })
  })
})

describe('persistencia del token', () => {
  afterEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('guarda, lee y limpia el token con el prefijo SATRE', () => {
    setToken('abc.def')
    expect(getToken()).toBe('abc.def')
    expect(sessionStorage.getItem(`${STORAGE_PREFIX}token`)).toBe('abc.def')

    sessionStorage.setItem(`${STORAGE_PREFIX}extra`, '1')
    localStorage.setItem(`${STORAGE_PREFIX}extra`, '1')
    clearStoredSession()

    expect(getToken()).toBeNull()
    expect(sessionStorage.getItem(`${STORAGE_PREFIX}extra`)).toBeNull()
    expect(localStorage.getItem(`${STORAGE_PREFIX}extra`)).toBeNull()
  })
})

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
    blob: async () => new Blob(['ok']),
  }
}

describe('buildApiUrl y ApiError', () => {
  it('normaliza paths con y sin /api duplicado', () => {
    expect(buildApiUrl('/auth/login')).toBe(`${DEFAULT_API_URL}/auth/login`)
    expect(buildApiUrl('auth/login')).toBe(`${DEFAULT_API_URL}/auth/login`)
    expect(buildApiUrl('/api/auth/login')).toBe(`${DEFAULT_API_URL}/auth/login`)
    expect(buildApiUrl('/api')).toBe(`${DEFAULT_API_URL}/`)
  })

  it('rellena los defaults de ApiError', () => {
    const error = new ApiError('falló')
    expect(error.name).toBe('ApiError')
    expect(error.status).toBe(0)
    expect(error.kind).toBe('http')
    expect(error.fieldErrors).toEqual({})
    expect(error.errors).toEqual({})
    expect(error.retryAfter).toBeNull()
  })
})

describe('apiRequest y refreshAccessToken', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    sessionStorage.clear()
    localStorage.clear()
  })

  it('envía JSON autenticado y devuelve el payload', async () => {
    setToken('jwt')
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({ ok: true }))

    await expect(apiRequest('/auth/me', { method: 'POST', body: { ping: 1 } })).resolves.toEqual({
      ok: true,
    })

    const [url, options] = globalThis.fetch.mock.calls[0]
    expect(url).toBe(`${DEFAULT_API_URL}/auth/me`)
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer jwt')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.body).toBe(JSON.stringify({ ping: 1 }))
  })

  it('no fuerza Content-Type en FormData y acepta token explícito', async () => {
    const form = new FormData()
    form.append('file', new Blob(['a']), 'a.csv')
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({ imported: 1 }))

    await apiRequest('/admin/enrollments/bulk', { method: 'POST', body: form, token: 'otro' })

    const [, options] = globalThis.fetch.mock.calls[0]
    expect(options.headers['Content-Type']).toBeUndefined()
    expect(options.headers.Authorization).toBe('Bearer otro')
    expect(options.body).toBe(form)
  })

  it('devuelve blob y filename desde Content-Disposition', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'Content-Disposition': 'attachment; filename="reporte.csv"',
      }),
      blob: async () => new Blob(['csv']),
      json: async () => ({}),
    })

    const result = await apiRequest('/admin/export', { responseType: 'blob' })
    expect(result.filename).toBe('reporte.csv')
    expect(result.blob).toBeInstanceOf(Blob)

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'Content-Disposition': "attachment; filename*=UTF-8''notas%20ib.csv",
      }),
      blob: async () => new Blob(['csv']),
      json: async () => ({}),
    })
    await expect(apiRequest('/admin/export', { responseType: 'blob' })).resolves.toMatchObject({
      filename: 'notas ib.csv',
    })

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      blob: async () => new Blob(['csv']),
      json: async () => ({}),
    })
    await expect(apiRequest('/admin/export', { responseType: 'blob' })).resolves.toMatchObject({
      filename: null,
    })
  })

  it('emite eventos y clasifica 403, 422 y 429', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeApiEvents(listener)

    globalThis.fetch.mockResolvedValueOnce(
      jsonResponse({ must_change_password: true, message: 'Cambia tu clave' }, { status: 403 }),
    )
    await expect(apiRequest('/admin/users')).rejects.toMatchObject({
      status: 403,
      kind: 'forbidden',
    })
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'password_change_required' }),
    )

    globalThis.fetch.mockResolvedValueOnce(
      jsonResponse({ message: 'No' }, { status: 403 }),
    )
    await expect(apiRequest('/admin/users')).rejects.toMatchObject({ kind: 'forbidden' })
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'forbidden' }))

    globalThis.fetch.mockResolvedValueOnce(
      jsonResponse({ errors: { email: ['Requerido'] } }, { status: 422 }),
    )
    await expect(apiRequest('/auth/login', { skipAuthHandling: true })).rejects.toMatchObject({
      kind: 'validation',
      fieldErrors: { email: 'Requerido' },
    })

    globalThis.fetch.mockResolvedValueOnce(
      jsonResponse({}, { status: 429, headers: { 'Retry-After': '8' } }),
    )
    await expect(apiRequest('/auth/login', { skipAuthHandling: true })).rejects.toMatchObject({
      kind: 'rate_limited',
      retryAfter: 8,
    })
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'rate_limited' }))

    globalThis.fetch.mockResolvedValueOnce(jsonResponse({}, { status: 404 }))
    await expect(apiRequest('/missing')).rejects.toMatchObject({
      kind: 'http',
      message: 'El recurso solicitado no existe.',
    })

    unsubscribe()
  })

  it('no emite toasts cuando silent es true', async () => {
    const listener = vi.fn()
    subscribeApiEvents(listener)

    globalThis.fetch.mockResolvedValueOnce(jsonResponse({ message: 'No' }, { status: 403 }))
    await expect(apiRequest('/admin/users', { silent: true })).rejects.toMatchObject({ status: 403 })

    globalThis.fetch.mockResolvedValueOnce(jsonResponse({}, { status: 429 }))
    await expect(apiRequest('/admin/users', { silent: true })).rejects.toMatchObject({ status: 429 })

    expect(listener).not.toHaveBeenCalled()
  })

  it('refresca el token ante 401 y reintenta la petición original', async () => {
    setToken('viejo')
    const listener = vi.fn()
    subscribeApiEvents(listener)

    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, { status: 401 }))
      .mockResolvedValueOnce(
        jsonResponse({ token: 'nuevo', expires_at: '2099-01-01T00:00:00.000Z' }),
      )
      .mockResolvedValueOnce(jsonResponse({ me: true }))

    await expect(apiRequest('/auth/me')).resolves.toEqual({ me: true })
    expect(getToken()).toBe('nuevo')
    expect(listener).toHaveBeenCalledWith({
      type: 'token_refreshed',
      expiresAt: '2099-01-01T00:00:00.000Z',
    })
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
  })

  it('unifica refrescos concurrentes y emite unauthorized si fallan', async () => {
    setToken('viejo')
    const listener = vi.fn()
    subscribeApiEvents(listener)

    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ message: 'no' }, { status: 401 }))

    const first = apiRequest('/auth/me')
    const second = apiRequest('/auth/me')

    await expect(first).rejects.toMatchObject({ status: 401 })
    await expect(second).rejects.toMatchObject({ status: 401 })
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'unauthorized' }))
  })

  it('emite unauthorized en 401 sin token o con skipAuthHandling', async () => {
    const listener = vi.fn()
    subscribeApiEvents(listener)

    globalThis.fetch.mockResolvedValueOnce(jsonResponse({ message: 'expired' }, { status: 401 }))
    await expect(apiRequest('/auth/me')).rejects.toMatchObject({ kind: 'unauthorized' })
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'unauthorized' }))

    listener.mockClear()
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({ message: 'bad' }, { status: 401 }))
    await expect(apiRequest('/auth/login', { skipAuthHandling: true })).rejects.toMatchObject({
      status: 401,
    })
    expect(listener).not.toHaveBeenCalled()
  })

  it('refreshAccessToken rechaza sin token y emite expires_at nulo', async () => {
    await expect(refreshAccessToken()).rejects.toMatchObject({ kind: 'unauthorized', status: 401 })

    setToken('vivo')
    const listener = vi.fn()
    subscribeApiEvents(listener)
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({ token: 'rotado' }))

    await expect(refreshAccessToken()).resolves.toEqual({ token: 'rotado' })
    expect(listener).toHaveBeenCalledWith({ type: 'token_refreshed', expiresAt: null })
  })

  it('traduce abort, timeout y error de red', async () => {
    const listener = vi.fn()
    subscribeApiEvents(listener)

    const controller = new AbortController()
    controller.abort()
    globalThis.fetch.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
    await expect(apiRequest('/auth/me', { signal: controller.signal })).rejects.toMatchObject({
      kind: 'aborted',
    })
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'aborted' }))

    globalThis.fetch.mockImplementationOnce(
      (_url, options) =>
        new Promise((_, reject) => {
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
        }),
    )
    await expect(apiRequest('/auth/me', { timeout: 15 })).rejects.toMatchObject({ kind: 'timeout' })
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'timeout' }))

    listener.mockClear()
    globalThis.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(apiRequest('/auth/me', { silent: true })).rejects.toMatchObject({ kind: 'network' })
    expect(listener).not.toHaveBeenCalled()

    globalThis.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(apiRequest('/auth/me')).rejects.toMatchObject({ kind: 'network' })
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'network' }))
  })

  it('tolera JSON inválido en respuestas de error', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => {
        throw new Error('no json')
      },
    })

    await expect(apiRequest('/boom')).rejects.toMatchObject({
      message: 'No se pudo completar la solicitud. Inténtalo nuevamente.',
    })
  })
})

