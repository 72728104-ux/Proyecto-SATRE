import { apiRequest, buildApiUrl, setToken } from './client.js'

const LOGIN_PATH = '/auth/login'

export async function loginRequest(email, password) {
  const fullUrl = buildApiUrl(LOGIN_PATH)
  console.log('Login Request URL:', fullUrl)
  const data = await apiRequest(LOGIN_PATH, {
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

export function healthRequest(options = {}) {
  return apiRequest('/health', { ...options, silent: true, skipAuthHandling: true, timeout: 4000 })
}
