import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CambiarContrasena from './CambiarContrasena'
import { changePassword } from '../api/auth'

vi.mock('../api/auth', () => ({ changePassword: vi.fn() }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}))
vi.mock('../components/Toast', () => ({
  useToast: () => ({ success: toastSuccess, error: vi.fn() }),
}))

const toastSuccess = vi.fn()
const logout = vi.fn()
let authState

function resetAuth(overrides = {}) {
  authState = {
    user: { email: 'estudiante@coar.edu.pe' },
    role: 'estudiante',
    mustChangePassword: false,
    changePassword,
    logout,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/cambiar-contrasena']}>
      <Routes>
        <Route path="/cambiar-contrasena" element={<CambiarContrasena />} />
        <Route path="/estudiante" element={<div>Home estudiante</div>} />
        <Route path="/tutor" element={<div>Home tutor</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const currentPassword = () => screen.getByLabelText(/^Contraseña actual/)
const newPassword = () => screen.getByLabelText(/^Nueva contraseña/)
const confirmPassword = () => screen.getByLabelText(/^Confirmar nueva contraseña/)

function fill({ current = 'PasswordActual123', password = 'NuevaPassword123', confirmation = 'NuevaPassword123' } = {}) {
  fireEvent.change(currentPassword(), { target: { value: current } })
  fireEvent.change(newPassword(), { target: { value: password } })
  fireEvent.change(confirmPassword(), { target: { value: confirmation } })
}

describe('CambiarContrasena', () => {
  beforeEach(() => {
    resetAuth()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('muestra el correo del usuario y el enlace de vuelta a su inicio', () => {
    renderPage()

    expect(screen.getByText('estudiante@coar.edu.pe')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Cambiar contraseña' })).toBeTruthy()
    const back = screen.getByRole('link', { name: 'Volver' })
    expect(back.getAttribute('href')).toBe('/estudiante')
  })

  it('valida la longitud minima y la diferencia con la contrasena actual', async () => {
    renderPage()

    fill({ password: 'corta', confirmation: 'corta' })
    fireEvent.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    expect(await screen.findByText(/debe tener al menos 10 caracteres/i)).toBeTruthy()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('exige que la nueva contrasena sea distinta de la actual', async () => {
    renderPage()

    fill({ password: 'PasswordActual123', confirmation: 'PasswordActual123' })
    fireEvent.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    expect(await screen.findByText(/debe ser distinta de la contraseña actual/i)).toBeTruthy()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('exige que la confirmacion coincida con la nueva contrasena', async () => {
    renderPage()

    fill({ confirmation: 'OtraPassword123' })
    fireEvent.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeTruthy()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('exige la contrasena actual', async () => {
    renderPage()

    fill({ current: '' })
    fireEvent.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    expect(await screen.findByText(/ingresa tu contraseña actual/i)).toBeTruthy()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('guarda la nueva contrasena cuando el formulario es valido', async () => {
    changePassword.mockResolvedValue({ ok: true })
    renderPage()

    fill()
    fireEvent.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    await waitFor(() => expect(changePassword).toHaveBeenCalled())
    expect(changePassword).toHaveBeenCalledWith({
      current_password: 'PasswordActual123',
      password: 'NuevaPassword123',
      password_confirmation: 'NuevaPassword123',
    })
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Contraseña actualizada correctamente.'))
    expect(await screen.findByText('Home estudiante')).toBeTruthy()
  })

  it('vuelve al home del rol aunque no exista un mapa explicito', async () => {
    resetAuth({ role: 'rol-desconocido' })
    changePassword.mockResolvedValue({ ok: true })
    render(
      <MemoryRouter initialEntries={['/cambiar-contrasena']}>
        <Routes>
          <Route path="/cambiar-contrasena" element={<CambiarContrasena />} />
          <Route path="/" element={<div>Raíz</div>} />
        </Routes>
      </MemoryRouter>,
    )

    fill()
    fireEvent.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    expect(await screen.findByText('Raíz')).toBeTruthy()
  })

  it('muestra el error general cuando la API falla sin errores por campo', async () => {
    changePassword.mockRejectedValue({ message: 'La contraseña actual no es correcta.' })
    renderPage()

    fill()
    fireEvent.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    expect(await screen.findByText('La contraseña actual no es correcta.')).toBeTruthy()
    expect(changePassword).toHaveBeenCalledTimes(1)
  })

  it('muestra los errores por campo devueltos por la API', async () => {
    changePassword.mockRejectedValue({ fieldErrors: { current_password: 'La contraseña actual no es correcta.' } })
    renderPage()

    fill()
    fireEvent.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    expect(await screen.findByText('La contraseña actual no es correcta.')).toBeTruthy()
    expect(currentPassword().getAttribute('aria-invalid')).toBe('true')
  })

  it('muestra el estado de carga y deshabilita el boton mientras guarda', async () => {
    let resolveSubmit
    changePassword.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve
        }),
    )
    renderPage()

    fill()
    fireEvent.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    expect(await screen.findByRole('button', { name: /guardando/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /guardando/i }).disabled).toBe(true)
    resolveSubmit({ ok: true })
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
  })

  it('pide cambiar la contrasena y permite cerrar sesion cuando es obligatorio', () => {
    resetAuth({ mustChangePassword: true })
    renderPage()

    expect(screen.getByRole('heading', { name: 'Cambia tu contraseña' })).toBeTruthy()
    expect(screen.getByText(/debes definir una contraseña personal/i)).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Volver' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(logout).toHaveBeenCalledTimes(1)
  })
})
