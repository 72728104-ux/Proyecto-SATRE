import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'

vi.mock('../components/Toast', () => ({
  useToast: vi.fn(() => ({
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  })),
}))

vi.mock('../hooks/useIdleTimeout', () => ({
  touchActivity: vi.fn(),
  useIdleTimeout: vi.fn(),
}))

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getToken: vi.fn(() => null),
    setToken: vi.fn(),
    clearStoredSession: vi.fn(),
    subscribeApiEvents: vi.fn(() => () => {}),
  }
})

vi.mock('../api/auth', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    loginRequest: vi.fn(),
    logoutRequest: vi.fn(),
    meRequest: vi.fn(),
    refreshRequest: vi.fn(),
    revokeTokenRequest: vi.fn(),
    changePasswordRequest: vi.fn(),
    readSession: vi.fn(() => null),
    writeSession: vi.fn(),
  }
})

const { useToast } = await import('../components/Toast')
const { touchActivity, useIdleTimeout } = await import('../hooks/useIdleTimeout')
const { getToken, setToken, clearStoredSession, subscribeApiEvents } = await import('../api/client')
const {
  loginRequest,
  logoutRequest,
  meRequest,
  refreshRequest,
  revokeTokenRequest,
  changePasswordRequest,
  readSession,
  writeSession,
  mapApiUser,
} = await import('../api/auth')
const { AuthProvider, useAuth } = await import('./AuthContext')

const apiUser = {
  id: 7,
  name: 'Ana Tutor',
  email: 'ana@coar.edu.pe',
  must_change_password: false,
  role: { slug: 'teacher', name: 'Docente' },
  students: [{ id: 3, first_name: 'Luis' }],
}

function mappedUser(overrides = {}) {
  return { ...mapApiUser(apiUser, false), ...overrides }
}

function AuthProbe() {
  const auth = useAuth()
  const [loginResult, setLoginResult] = useState(null)
  const [changeResult, setChangeResult] = useState(null)

  return (
    <div>
      <span data-testid="children">Sesión lista</span>
      <span data-testid="auth">{auth.isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="name">{auth.user?.name ?? ''}</span>
      <span data-testid="role">{auth.role ?? ''}</span>
      <span data-testid="label">{auth.roleLabel ?? ''}</span>
      <span data-testid="home">{auth.homePath}</span>
      <span data-testid="must">{String(auth.mustChangePassword)}</span>
      <span data-testid="reason">{auth.logoutReason ?? ''}</span>
      <button type="button" onClick={async () => setLoginResult(await auth.login('ana@coar.edu.pe', 'secret'))}>
        login
      </button>
      <button type="button" onClick={() => auth.logout('manual')}>
        logout
      </button>
      <button
        type="button"
        onClick={async () =>
          setChangeResult(
            await auth.changePassword({
              current_password: 'old',
              password: 'new-password',
              password_confirmation: 'new-password',
            }),
          )
        }
      >
        change
      </button>
      {loginResult ? <pre data-testid="login-result">{JSON.stringify(loginResult)}</pre> : null}
      {changeResult ? <pre data-testid="change-result">{JSON.stringify(changeResult)}</pre> : null}
    </div>
  )
}

function renderAuth() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  )
}

describe('AuthProvider', () => {
  let apiListener
  let toast
  let idleOptions

  beforeEach(() => {
    toast = { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() }
    useToast.mockReturnValue(toast)
    apiListener = null
    idleOptions = null

    getToken.mockReturnValue(null)
    readSession.mockReturnValue(null)
    meRequest.mockResolvedValue({})
    logoutRequest.mockResolvedValue({})
    refreshRequest.mockResolvedValue({})
    revokeTokenRequest.mockResolvedValue({})
    writeSession.mockReset()
    setToken.mockReset()
    clearStoredSession.mockReset()
    touchActivity.mockReset()

    subscribeApiEvents.mockImplementation((listener) => {
      apiListener = listener
      return vi.fn()
    })
    useIdleTimeout.mockImplementation((options) => {
      idleOptions = options
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renderiza los children y hidrata el estado inicial sin sesión', () => {
    renderAuth()

    expect(screen.getByTestId('children').textContent).toBe('Sesión lista')
    expect(screen.getByTestId('auth').textContent).toBe('no')
    expect(screen.getByTestId('home').textContent).toBe('/login')
    expect(meRequest).not.toHaveBeenCalled()
  })

  it('hidrata al usuario con mapApiUser cuando hay token y /auth/me responde', async () => {
    const session = { user: mappedUser(), expiresAt: null }
    getToken.mockReturnValue('token-vivo')
    readSession.mockReturnValue(session)
    meRequest.mockResolvedValue({
      user: { ...apiUser, name: 'Ana Actualizada', must_change_password: true },
    })

    renderAuth()

    await waitFor(() => {
      expect(screen.getByTestId('name').textContent).toBe('Ana Actualizada')
    })
    expect(screen.getByTestId('must').textContent).toBe('true')
    expect(screen.getByTestId('role').textContent).toBe('tutor')
    expect(meRequest).toHaveBeenCalledWith(expect.objectContaining({ silent: true }))
  })

  it('no muta sesión si /auth/me llega sin sesión local', async () => {
    getToken.mockReturnValue('token-vivo')
    readSession.mockReturnValue(null)
    meRequest.mockResolvedValue({ user: apiUser })

    renderAuth()

    await waitFor(() => expect(meRequest).toHaveBeenCalled())
    expect(screen.getByTestId('auth').textContent).toBe('no')
    expect(writeSession).not.toHaveBeenCalled()
  })

  it('ignora fallos de /auth/me y respuestas sin user', async () => {
    getToken.mockReturnValue('token-vivo')
    readSession.mockReturnValue({ user: mappedUser({ name: 'Ana Tutor' }), expiresAt: null })
    meRequest.mockRejectedValueOnce(new Error('red'))

    const { unmount } = renderAuth()
    await waitFor(() => expect(meRequest).toHaveBeenCalled())
    expect(screen.getByTestId('name').textContent).toBe('Ana Tutor')
    unmount()

    meRequest.mockResolvedValueOnce({ token: 'x' })
    renderAuth()
    await waitFor(() => expect(meRequest).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('name').textContent).toBe('Ana Tutor')
  })

  it('login exitoso persiste la sesión y revoca el token anterior', async () => {
    getToken.mockReturnValue('token-viejo')
    loginRequest.mockResolvedValue({
      token: 'token-nuevo',
      user: apiUser,
      expires_at: '2099-01-01T00:00:00.000Z',
      must_change_password: true,
    })
    revokeTokenRequest.mockRejectedValue(new Error('ya revocado'))

    renderAuth()
    screen.getByRole('button', { name: 'login' }).click()

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('login-result').textContent)).toEqual({
        ok: true,
        user: mapApiUser(apiUser, true),
      })
    })
    expect(touchActivity).toHaveBeenCalled()
    expect(writeSession).toHaveBeenCalledWith({
      user: mapApiUser(apiUser, true),
      expiresAt: '2099-01-01T00:00:00.000Z',
    })
    expect(revokeTokenRequest).toHaveBeenCalledWith('token-viejo')
    expect(screen.getByTestId('must').textContent).toBe('true')
    expect(screen.getByTestId('home').textContent).toBe('/cambiar-contrasena')
  })

  it('login usa must_change_password del usuario y expires_at nulo', async () => {
    loginRequest.mockResolvedValue({
      token: 'token-nuevo',
      user: { ...apiUser, must_change_password: false },
    })

    renderAuth()
    screen.getByRole('button', { name: 'login' }).click()

    await waitFor(() => expect(screen.getByTestId('login-result')).toBeTruthy())
    expect(JSON.parse(screen.getByTestId('login-result').textContent).ok).toBe(true)
    expect(screen.getByTestId('home').textContent).toBe('/tutor')
    expect(writeSession).toHaveBeenCalledWith({
      user: mapApiUser(apiUser, false),
      expiresAt: null,
    })
    expect(revokeTokenRequest).not.toHaveBeenCalled()
  })

  it('login devuelve fieldErrors cuando el API falla', async () => {
    const error = new Error('Credenciales inválidas')
    error.fieldErrors = { email: 'El correo es obligatorio.' }
    loginRequest.mockRejectedValue(error)

    renderAuth()
    screen.getByRole('button', { name: 'login' }).click()

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('login-result').textContent)).toEqual({
        ok: false,
        message: 'Credenciales inválidas',
        fieldErrors: { email: 'El correo es obligatorio.' },
      })
    })
    expect(screen.getByTestId('auth').textContent).toBe('no')
  })

  it('login sin fieldErrors deja un objeto vacío', async () => {
    loginRequest.mockRejectedValue(new Error('Servidor no disponible'))

    renderAuth()
    screen.getByRole('button', { name: 'login' }).click()

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('login-result').textContent)).toEqual({
        ok: false,
        message: 'Servidor no disponible',
        fieldErrors: {},
      })
    })
  })

  it('logout limpia la sesión aunque el API falle', async () => {
    readSession.mockReturnValue({ user: mappedUser(), expiresAt: null })
    logoutRequest.mockRejectedValue(new Error('revocado'))

    renderAuth()
    expect(screen.getByTestId('auth').textContent).toBe('yes')
    screen.getByRole('button', { name: 'logout' }).click()

    await waitFor(() => {
      expect(screen.getByTestId('auth').textContent).toBe('no')
    })
    expect(setToken).toHaveBeenCalledWith(null)
    expect(clearStoredSession).toHaveBeenCalled()
    expect(screen.getByTestId('reason').textContent).toBe('manual')
  })

  it('changePassword actualiza el usuario mapeado o solo el flag', async () => {
    readSession.mockReturnValue({ user: mappedUser({ mustChangePassword: true }), expiresAt: null })
    changePasswordRequest.mockResolvedValueOnce({
      user: { ...apiUser, name: 'Ana Nueva', must_change_password: false },
    })

    renderAuth()
    screen.getByRole('button', { name: 'change' }).click()

    await waitFor(() => {
      expect(screen.getByTestId('name').textContent).toBe('Ana Nueva')
    })
    expect(screen.getByTestId('must').textContent).toBe('false')

    changePasswordRequest.mockResolvedValueOnce({})
    screen.getByRole('button', { name: 'change' }).click()
    await waitFor(() => {
      expect(screen.getByTestId('must').textContent).toBe('false')
    })
  })

  it('reacciona a eventos del cliente: unauthorized, refresh, password y toasts', async () => {
    readSession.mockReturnValue({ user: mappedUser(), expiresAt: '2099-01-01T00:00:00.000Z' })

    renderAuth()
    expect(apiListener).toBeTypeOf('function')

    apiListener({ type: 'token_refreshed', expiresAt: '2099-06-01T00:00:00.000Z' })
    await waitFor(() => {
      expect(writeSession).toHaveBeenCalledWith({
        user: mappedUser(),
        expiresAt: '2099-06-01T00:00:00.000Z',
      })
    })

    apiListener({ type: 'password_change_required' })
    await waitFor(() => {
      expect(screen.getByTestId('must').textContent).toBe('true')
    })

    apiListener({ type: 'rate_limited', error: { message: 'Espera 12 s' } })
    expect(toast.warning).toHaveBeenCalledWith('Espera 12 s')

    apiListener({ type: 'forbidden', error: { message: 'Sin permiso' } })
    expect(toast.error).toHaveBeenCalledWith('Sin permiso')

    apiListener({ type: 'network' })
    expect(toast.error).toHaveBeenCalledTimes(1)

    apiListener({ type: 'unauthorized', error: { message: 'expiró' } })
    await waitFor(() => {
      expect(screen.getByTestId('auth').textContent).toBe('no')
    })
    expect(screen.getByTestId('reason').textContent).toBe('expired')
  })

  it('token_refreshed no escribe si no hay sesión', () => {
    renderAuth()
    apiListener({ type: 'token_refreshed', expiresAt: '2099-06-01T00:00:00.000Z' })
    expect(writeSession).not.toHaveBeenCalled()
  })

  it('token_refreshed conserva expiresAt actual si el evento no trae fecha', async () => {
    readSession.mockReturnValue({ user: mappedUser(), expiresAt: '2099-01-01T00:00:00.000Z' })
    renderAuth()

    apiListener({ type: 'token_refreshed' })
    await waitFor(() => {
      expect(writeSession).toHaveBeenCalledWith({
        user: mappedUser(),
        expiresAt: '2099-01-01T00:00:00.000Z',
      })
    })
  })

  it('deriva homePath, roleLabel y cargo según el rol', () => {
    readSession.mockReturnValue({
      user: mappedUser({ role: 'desconocido', cargo: 'Invitado COAR' }),
      expiresAt: null,
    })

    renderAuth()

    expect(screen.getByTestId('home').textContent).toBe('/403')
    expect(screen.getByTestId('label').textContent).toBe('Invitado COAR')
    expect(idleOptions.enabled).toBe(true)
  })

  it('programa refresh y limpia la sesión si falla', async () => {
    refreshRequest.mockRejectedValue(new Error('refresh falló'))
    readSession.mockReturnValue({
      user: mappedUser(),
      expiresAt: new Date(Date.now() + 50).toISOString(),
    })

    renderAuth()

    await waitFor(() => {
      expect(refreshRequest).toHaveBeenCalled()
      expect(screen.getByTestId('reason').textContent).toBe('expired')
    })
  })

  it('no programa refresh si expiresAt es inválido', () => {
    readSession.mockReturnValue({ user: mappedUser(), expiresAt: 'no-es-fecha' })
    renderAuth()
    expect(refreshRequest).not.toHaveBeenCalled()
  })

  it('useIdleTimeout dispara logout por inactividad', async () => {
    readSession.mockReturnValue({ user: mappedUser(), expiresAt: null })
    logoutRequest.mockResolvedValue({})

    renderAuth()
    expect(idleOptions.enabled).toBe(true)
    idleOptions.onIdle()

    await waitFor(() => {
      expect(screen.getByTestId('reason').textContent).toBe('inactivity')
    })
  })
})

describe('useAuth', () => {
  afterEach(() => {
    cleanup()
  })

  it('lanza si se usa fuera de AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<AuthProbe />)
    }).toThrow('useAuth debe usarse dentro de AuthProvider')

    spy.mockRestore()
  })
})
