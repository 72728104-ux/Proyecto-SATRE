import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { changePasswordRequest, loginRequest, logoutRequest, meRequest, refreshRequest, revokeTokenRequest } from '../api/auth'
import { STORAGE_PREFIX, clearStoredSession, getToken, setToken, subscribeApiEvents } from '../api/client'
import { useToast } from '../components/Toast'
import { API_ROLE_TO_UI, CHANGE_PASSWORD_PATH, ROLE_HOME, ROLE_LABELS, ROLES } from '../data/roles'
import { touchActivity, useIdleTimeout } from '../hooks/useIdleTimeout'

const STORAGE_KEY = `${STORAGE_PREFIX}session`
const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const MAX_TIMEOUT_MS = 2 ** 31 - 1

const AuthContext = createContext(null)

const mapApiUser = (apiUser, mustChangePassword = apiUser.must_change_password) => {
  const role = API_ROLE_TO_UI[apiUser.role?.slug] ?? apiUser.role?.slug
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role,
    cargo: apiUser.role?.name,
    mustChangePassword: Boolean(mustChangePassword),
    students: Array.isArray(apiUser.students) ? apiUser.students : [],
  }
}

const isExpired = (expiresAt) => Boolean(expiresAt) && new Date(expiresAt).getTime() <= Date.now()

const readSession = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const session = raw ? JSON.parse(raw) : null
    if (!session?.user || !getToken() || isExpired(session.expiresAt)) {
      clearStoredSession()
      return null
    }
    return session
  } catch {
    clearStoredSession()
    return null
  }
}

const writeSession = (session) => {
  if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  else sessionStorage.removeItem(STORAGE_KEY)
}

export function AuthProvider({ children }) {
  const toast = useToast()
  const [session, setSession] = useState(readSession)
  const [logoutReason, setLogoutReason] = useState(null)

  const updateUser = useCallback((patch) => {
    setSession((current) => {
      if (!current) return current
      const next = { ...current, user: { ...current.user, ...patch } }
      writeSession(next)
      return next
    })
  }, [])

  const clearSession = useCallback((reason = null) => {
    setToken(null)
    clearStoredSession()
    setSession(null)
    setLogoutReason(reason)
  }, [])

  const login = useCallback(async (email, password) => {
    const previousToken = getToken()
    try {
      const data = await loginRequest(email, password)
      if (previousToken && previousToken !== data.token) revokeTokenRequest(previousToken).catch(() => {})
      const user = mapApiUser(data.user, data.must_change_password ?? data.user.must_change_password)
      const next = { user, expiresAt: data.expires_at ?? null }
      touchActivity()
      writeSession(next)
      setSession(next)
      setLogoutReason(null)
      return { ok: true, user }
    } catch (error) {
      return { ok: false, message: error.message, fieldErrors: error.fieldErrors ?? {} }
    }
  }, [])

  const logout = useCallback(
    async (reason = null) => {
      try {
        await logoutRequest()
      } catch {
        // El token puede estar ya revocado; la sesión local se borra igual.
      } finally {
        clearSession(reason)
      }
    },
    [clearSession],
  )

  const changePassword = useCallback(
    async (payload) => {
      const data = await changePasswordRequest(payload)
      updateUser(data?.user ? mapApiUser(data.user, false) : { mustChangePassword: false })
      return data
    },
    [updateUser],
  )

  useEffect(
    () =>
      subscribeApiEvents((event) => {
        const { type, error } = event
        if (type === 'unauthorized') {
          clearSession('expired')
        } else if (type === 'token_refreshed') {
          setSession((current) => {
            if (!current) return current
            const next = { ...current, expiresAt: event.expiresAt ?? current.expiresAt }
            writeSession(next)
            return next
          })
        } else if (type === 'password_change_required') {
          updateUser({ mustChangePassword: true })
        } else if (type === 'rate_limited') {
          toast.warning(error.message)
        } else if (error) {
          toast.error(error.message)
        }
      }),
    [clearSession, updateUser, toast],
  )

  useEffect(() => {
    if (!getToken()) return undefined
    const controller = new AbortController()
    meRequest({ signal: controller.signal, silent: true })
      .then((data) => {
        if (data?.user) updateUser(mapApiUser(data.user))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [updateUser])

  const expiresAt = session?.expiresAt
  useEffect(() => {
    if (!expiresAt) return undefined
    const expiresMs = new Date(expiresAt).getTime()
    if (Number.isNaN(expiresMs)) return undefined
    const refreshIn = expiresMs - Date.now() - 2 * 60 * 1000
    const timer = setTimeout(() => {
      refreshRequest().catch(() => clearSession('expired'))
    }, Math.min(Math.max(refreshIn, 0), MAX_TIMEOUT_MS))
    return () => clearTimeout(timer)
  }, [expiresAt, clearSession])

  useIdleTimeout({
    enabled: Boolean(session),
    timeoutMs: IDLE_TIMEOUT_MS,
    onIdle: () => logout('inactivity'),
  })

  const value = useMemo(() => {
    const user = session?.user ?? null
    const role = user?.role ?? null
    return {
      user,
      isAuthenticated: Boolean(user),
      role,
      roleLabel: user ? (ROLE_LABELS[role] ?? user.cargo) : null,
      homePath: !user ? '/login' : user.mustChangePassword ? CHANGE_PASSWORD_PATH : (ROLE_HOME[role] ?? '/403'),
      mustChangePassword: Boolean(user?.mustChangePassword),
      logoutReason,
      login,
      logout,
      changePassword,
      roles: ROLES,
    }
  }, [session, logoutReason, login, logout, changePassword])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
