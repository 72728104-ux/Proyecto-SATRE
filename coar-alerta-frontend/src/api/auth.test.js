import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_PREFIX, getToken, setToken } from './client.js'

vi.mock('./client.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, apiRequest: vi.fn() }
})

const { apiRequest } = await import('./client.js')
const { loginRequest, logoutRequest, mapApiUser, readSession, writeSession, SESSION_STORAGE_KEY } =
  await import('./auth.js')

const apiUser = {
  id: 7,
  name: 'Ana Tutor',
  email: 'ana@coar.edu.pe',
  must_change_password: true,
  role: { slug: 'teacher', name: 'Docente' },
  students: [{ id: 3, first_name: 'Luis' }],
}

describe('mapApiUser', () => {
  it('traduce el slug de API al rol de UI y copia el perfil', () => {
    expect(mapApiUser(apiUser)).toEqual({
      id: 7,
      name: 'Ana Tutor',
      email: 'ana@coar.edu.pe',
      dni: null,
      role: 'tutor',
      cargo: 'Docente',
      mustChangePassword: true,
      collegeHasResidence: true,
      students: [{ id: 3, first_name: 'Luis' }],
    })
  })

  it('respeta el override de mustChangePassword y deja students vacío si no es lista', () => {
    expect(
      mapApiUser(
        { ...apiUser, role: { slug: 'guardian', name: 'Apoderado' }, students: null },
        false,
      ),
    ).toMatchObject({
      role: 'apoderado',
      cargo: 'Apoderado',
      mustChangePassword: false,
      students: [],
    })
  })

  it('deja el slug crudo cuando no hay mapeo conocido', () => {
    expect(mapApiUser({ ...apiUser, role: { slug: 'admin', name: 'Administrador COAR' } }).role).toBe(
      'admin',
    )
    expect(mapApiUser({ ...apiUser, role: { slug: 'desconocido', name: 'Otro' } }).role).toBe(
      'desconocido',
    )
  })

  it('respeta college_has_residence del perfil y asume internado si no viene', () => {
    expect(mapApiUser({ ...apiUser, college_has_residence: false }).collegeHasResidence).toBe(false)
    expect(mapApiUser({ ...apiUser, college_has_residence: true }).collegeHasResidence).toBe(true)
    expect(mapApiUser(apiUser).collegeHasResidence).toBe(true)
  })
})

describe('persistencia de estado de sesión', () => {
  const future = '2099-01-01T00:00:00.000Z'
  const past = '2000-01-01T00:00:00.000Z'

  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    apiRequest.mockReset()
  })

  afterEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('persiste y recupera la sesión solo si hay token vigente', () => {
    const session = { user: mapApiUser(apiUser, false), expiresAt: future }
    setToken('token-vivo')
    writeSession(session)

    expect(JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY))).toEqual(session)
    expect(readSession()).toEqual(session)
  })

  it('borra el estado almacenado si falta token, expiró o el JSON es inválido', () => {
    const session = { user: mapApiUser(apiUser), expiresAt: future }
    writeSession(session)
    expect(readSession()).toBeNull()
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()

    setToken('token-vivo')
    writeSession({ user: mapApiUser(apiUser), expiresAt: past })
    expect(readSession()).toBeNull()
    expect(getToken()).toBeNull()

    setToken('token-vivo')
    sessionStorage.setItem(SESSION_STORAGE_KEY, '{roto')
    expect(readSession()).toBeNull()
  })

  it('loginRequest guarda el token y logoutRequest lo elimina', async () => {
    apiRequest.mockResolvedValueOnce({ token: 'jwt-login', user: apiUser })
    await loginRequest('ana@coar.edu.pe', 'secret')
    expect(apiRequest).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { email: 'ana@coar.edu.pe', password: 'secret' },
      skipAuthHandling: true,
    })
    expect(getToken()).toBe('jwt-login')
    expect(sessionStorage.getItem(`${STORAGE_PREFIX}token`)).toBe('jwt-login')

    apiRequest.mockResolvedValueOnce({})
    await logoutRequest()
    expect(getToken()).toBeNull()
  })

  it('logoutRequest limpia el token aunque el API falle', async () => {
    setToken('jwt-stale')
    apiRequest.mockRejectedValueOnce(new Error('revocado'))
    await expect(logoutRequest()).rejects.toThrow('revocado')
    expect(getToken()).toBeNull()
  })

  it('writeSession(null) elimina la clave de sesión', () => {
    writeSession({ user: mapApiUser(apiUser), expiresAt: future })
    writeSession(null)
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })
})

describe('peticiones de autenticación restantes', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('revokeTokenRequest y meRequest delegan en el cliente', async () => {
    const { revokeTokenRequest, meRequest } = await import('./auth.js')
    apiRequest.mockResolvedValueOnce({})
    await revokeTokenRequest('jwt-previo')
    expect(apiRequest).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
      token: 'jwt-previo',
      silent: true,
      skipAuthHandling: true,
    })

    apiRequest.mockResolvedValueOnce({ user: apiUser })
    const signal = new AbortController().signal
    await meRequest({ signal, silent: true })
    expect(apiRequest).toHaveBeenCalledWith('/auth/me', { signal, silent: true })
  })

  it('change, forgot, reset y health construyen el body esperado', async () => {
    const {
      changePasswordRequest,
      forgotPasswordRequest,
      resetPasswordRequest,
      healthRequest,
    } = await import('./auth.js')

    apiRequest.mockResolvedValue({})
    await changePasswordRequest({
      current_password: 'old',
      password: 'new-password',
      password_confirmation: 'new-password',
    })
    expect(apiRequest).toHaveBeenCalledWith('/auth/change-password', {
      method: 'POST',
      body: {
        current_password: 'old',
        password: 'new-password',
        password_confirmation: 'new-password',
      },
    })

    await forgotPasswordRequest('ana@coar.edu.pe')
    expect(apiRequest).toHaveBeenCalledWith('/auth/forgot-password', {
      method: 'POST',
      body: { email: 'ana@coar.edu.pe' },
      skipAuthHandling: true,
    })

    await resetPasswordRequest({
      token: 'reset-token',
      email: 'ana@coar.edu.pe',
      password: 'new-password',
      password_confirmation: 'new-password',
    })
    expect(apiRequest).toHaveBeenCalledWith('/auth/reset-password', {
      method: 'POST',
      body: {
        token: 'reset-token',
        email: 'ana@coar.edu.pe',
        password: 'new-password',
        password_confirmation: 'new-password',
      },
      skipAuthHandling: true,
    })

    await healthRequest({ timeout: 1000 })
    expect(apiRequest).toHaveBeenCalledWith('/health', {
      timeout: 4000,
      silent: true,
      skipAuthHandling: true,
    })
  })

  it('mantiene la sesión válida y limpia el token cuando expira', () => {
    // A05 - P12
    const future = '2099-01-01T00:00:00.000Z'
    const expired = '2000-01-01T00:00:00.000Z'

    setToken('token-vivo')
    writeSession({ user: mapApiUser(apiUser), expiresAt: future })
    expect(readSession()).not.toBeNull()

    setToken('token-vivo')
    writeSession({ user: mapApiUser(apiUser), expiresAt: expired })
    expect(readSession()).toBeNull()
    expect(getToken()).toBeNull()
  })
})
