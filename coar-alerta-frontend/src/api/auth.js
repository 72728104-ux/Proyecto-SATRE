import { API_ROLE_TO_UI } from '../data/roles.js'
import { STORAGE_PREFIX, apiRequest, clearStoredSession, getToken, setToken } from './client.js'

export { refreshAccessToken as refreshRequest } from './client.js'

export const SESSION_STORAGE_KEY = `${STORAGE_PREFIX}session`

export function mapApiUser(apiUser, mustChangePassword = apiUser.must_change_password) {
  const role = API_ROLE_TO_UI[apiUser.role?.slug] ?? apiUser.role?.slug
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    dni: apiUser.dni ?? null,
    role,
    cargo: apiUser.role?.name,
    mustChangePassword: Boolean(mustChangePassword),
    collegeHasResidence: apiUser.college_has_residence !== false,
    students: Array.isArray(apiUser.students) ? apiUser.students : [],
  }
}

const isExpired = (expiresAt) => Boolean(expiresAt) && new Date(expiresAt).getTime() <= Date.now()

export function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
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

export function writeSession(session) {
  if (session) sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  else sessionStorage.removeItem(SESSION_STORAGE_KEY)
}

export async function loginRequest(email, password) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuthHandling: true,
  })
  setToken(data.token)
  return data
}

export async function logoutRequest() {
  try {
    await apiRequest('/auth/logout', { method: 'POST', silent: true, skipAuthHandling: true })
  } finally {
    setToken(null)
  }
}

export function revokeTokenRequest(token) {
  return apiRequest('/auth/logout', { method: 'POST', token, silent: true, skipAuthHandling: true })
}

export function meRequest(options = {}) {
  return apiRequest('/auth/me', options)
}

export function changePasswordRequest({ current_password, password, password_confirmation }) {
  return apiRequest('/auth/change-password', {
    method: 'POST',
    body: { current_password, password, password_confirmation },
  })
}

export function forgotPasswordRequest(email) {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: { email },
    skipAuthHandling: true,
  })
}

export function resetPasswordRequest({ token, email, password, password_confirmation }) {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: { token, email, password, password_confirmation },
    skipAuthHandling: true,
  })
}

export function healthRequest(options = {}) {
  return apiRequest('/health', { ...options, silent: true, skipAuthHandling: true, timeout: 4000 })
}
