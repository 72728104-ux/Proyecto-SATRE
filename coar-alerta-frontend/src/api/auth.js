import { apiRequest, refreshAccessToken, setToken } from './client.js'

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

export const refreshRequest = refreshAccessToken

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
