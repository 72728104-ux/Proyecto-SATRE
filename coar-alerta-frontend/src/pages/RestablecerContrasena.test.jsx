import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RestablecerContrasena from './RestablecerContrasena'
import { resetPasswordRequest } from '../api/auth'

vi.mock('../api/auth', () => ({ resetPasswordRequest: vi.fn() }))
vi.mock('../components/Toast', () => ({
  useToast: () => ({ success: toastSuccess, error: vi.fn() }),
}))

const toastSuccess = vi.fn()

function renderPage({ token = 'tok-123', email = 'estudiante@coar.edu.pe', path = '/reset-password' } = {}) {
  const query = token || email ? `?token=${token}&email=${encodeURIComponent(email)}` : ''
  return render(
    <MemoryRouter initialEntries={[`${path}${query}`]}>
      <Routes>
        <Route path="/reset-password" element={<RestablecerContrasena />} />
        <Route path="/login" element={<div>Login listo</div>} />
        <Route path="/recuperar-contrasena" element={<div>Recuperar listo</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const newPassword = () => screen.getByLabelText(/^Nueva contraseña/)
const confirmPassword = () => screen.getByLabelText(/^Confirmar nueva contraseña/)

function fill({ password = 'NuevaPassword123', confirmation = 'NuevaPassword123' } = {}) {
  fireEvent.change(newPassword(), { target: { value: password } })
  fireEvent.change(confirmPassword(), { target: { value: confirmation } })
}

describe('RestablecerContrasena', () => {
  beforeEach(() => {
    resetPasswordRequest.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('muestra el estado de enlace incompleto sin token', () => {
    renderPage({ token: '', email: '' })

    expect(screen.getByText(/enlace incompleto/i)).toBeTruthy()
    expect(screen.getByText(/solicita uno nuevo/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /solicitar enlace/i }).getAttribute('href')).toBe('/recuperar-contrasena')
    expect(resetPasswordRequest).not.toHaveBeenCalled()
  })

  it('muestra el estado de enlace incompleto si falta el correo', () => {
    renderPage({ token: 'tok-123', email: '' })

    expect(screen.getByText(/enlace incompleto/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /restablecer contraseña/i })).toBeNull()
  })

  it('muestra el correo y el enlace de vuelta al login', () => {
    renderPage()

    expect(screen.getByText('estudiante@coar.edu.pe')).toBeTruthy()
    expect(screen.getByRole('link', { name: /volver al inicio de sesión/i }).getAttribute('href')).toBe('/login')
  })

  it('valida la longitud minima de la nueva contrasena', async () => {
    renderPage()

    fill({ password: 'corta', confirmation: 'corta' })
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }))

    expect(await screen.findByText(/debe tener al menos 10 caracteres/i)).toBeTruthy()
    expect(resetPasswordRequest).not.toHaveBeenCalled()
  })

  it('valida que la confirmacion coincida', async () => {
    renderPage()

    fill({ confirmation: 'OtraPassword123' })
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }))

    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeTruthy()
    expect(resetPasswordRequest).not.toHaveBeenCalled()
  })

  it('restablece la contrasena y navega al login cuando el formulario es valido', async () => {
    resetPasswordRequest.mockResolvedValue({ ok: true })
    renderPage()

    fill()
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }))

    await waitFor(() => expect(resetPasswordRequest).toHaveBeenCalled())
    expect(resetPasswordRequest).toHaveBeenCalledWith({
      token: 'tok-123',
      email: 'estudiante@coar.edu.pe',
      password: 'NuevaPassword123',
      password_confirmation: 'NuevaPassword123',
    })
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Contraseña restablecida. Inicia sesión con tu nueva contraseña.'),
    )
    expect(await screen.findByText('Login listo')).toBeTruthy()
  })

  it('muestra el error general cuando el enlace expiro', async () => {
    resetPasswordRequest.mockRejectedValue({ message: 'El enlace expiró.' })
    renderPage()

    fill()
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }))

    expect(await screen.findByText('El enlace expiró.')).toBeTruthy()
    expect(screen.queryByText('Login listo')).toBeNull()
  })

  it('muestra los errores por campo devueltos por la API', async () => {
    resetPasswordRequest.mockRejectedValue({ fieldErrors: { password: 'La contraseña ya fue usada.' } })
    renderPage()

    fill()
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }))

    expect(await screen.findByText('La contraseña ya fue usada.')).toBeTruthy()
    expect(newPassword().getAttribute('aria-invalid')).toBe('true')
  })

  it('muestra el estado de carga y deshabilita el boton mientras guarda', async () => {
    let resolveSubmit
    resetPasswordRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve
        }),
    )
    renderPage()

    fill()
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }))

    expect(await screen.findByRole('button', { name: /guardando/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /guardando/i }).disabled).toBe(true)
    resolveSubmit({ ok: true })
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
  })
})
