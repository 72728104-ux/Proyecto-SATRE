import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoleSwitcher from './RoleSwitcher'
import { healthRequest } from '../api/auth'

vi.mock('../api/auth', () => ({ healthRequest: vi.fn() }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login }),
}))

const login = vi.fn()

function renderSwitcher() {
  return render(
    <MemoryRouter initialEntries={['/inicio']}>
      <Routes>
        <Route path="/inicio" element={<RoleSwitcher />} />
        <Route path="/admin" element={<div>Home admin</div>} />
        <Route path="/cambiar-contrasena" element={<div>Cambio obligatorio</div>} />
        <Route path="/403" element={<div>Sin rol</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function openForm() {
  const trigger = await screen.findByRole('button', { name: /cambiar cuenta/i })
  fireEvent.click(trigger)
  return trigger
}

describe('RoleSwitcher', () => {
  beforeEach(() => {
    healthRequest.mockReset()
    login.mockReset()
    healthRequest.mockResolvedValue({ status: 'ok' })
    login.mockResolvedValue({ ok: true, user: { role: 'admin', mustChangePassword: false } })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('solo aparece cuando el backend está disponible', async () => {
    renderSwitcher()

    expect(await screen.findByRole('button', { name: /cambiar cuenta/i })).toBeTruthy()
    expect(healthRequest).toHaveBeenCalledTimes(1)
  })

  it('no muestra el botón si el health falla o no está ok', async () => {
    healthRequest.mockRejectedValue(new Error('sin red'))
    const { unmount } = renderSwitcher()
    await waitFor(() => expect(healthRequest).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /cambiar cuenta/i })).toBeNull()
    unmount()

    healthRequest.mockReset()
    healthRequest.mockResolvedValue({ status: 'degraded' })
    renderSwitcher()
    expect(screen.queryByRole('button', { name: /cambiar cuenta/i })).toBeNull()
  })

  it('abre y cierra el formulario con aria-expanded', async () => {
    renderSwitcher()
    const trigger = await openForm()

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByLabelText(/^Correo o DNI/)).toBeTruthy()
    expect(screen.getByLabelText(/^Contraseña/)).toBeTruthy()

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByLabelText(/^Correo o DNI/)).toBeNull()
  })

  it('inicia sesión con otra cuenta y navega al home del rol', async () => {
    renderSwitcher()
    await openForm()

    fireEvent.change(screen.getByLabelText(/^Correo o DNI/), { target: { value: 'admin@coar.edu.pe' } })
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'secreto123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(login).toHaveBeenCalledWith('admin@coar.edu.pe', 'secreto123'))
    expect(await screen.findByText('Home admin')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Entrar' })).toBeNull()
  })

  it('navega a cambiar contraseña si la cuenta lo exige', async () => {
    login.mockResolvedValue({ ok: true, user: { role: 'tutor', mustChangePassword: true } })
    renderSwitcher()
    await openForm()

    fireEvent.change(screen.getByLabelText(/^Correo o DNI/), { target: { value: 'tutor@coar.edu.pe' } })
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'secreto123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Cambio obligatorio')).toBeTruthy()
  })

  it('redirige a 403 cuando el rol no tiene home', async () => {
    login.mockResolvedValue({ ok: true, user: { role: 'invitado', mustChangePassword: false } })
    renderSwitcher()
    await openForm()

    fireEvent.change(screen.getByLabelText(/^Correo o DNI/), { target: { value: 'x@coar.edu.pe' } })
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'secreto123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Sin rol')).toBeTruthy()
  })

  it('muestra el error de credenciales y permite reintentar', async () => {
    login.mockResolvedValue({ ok: false, message: 'Las credenciales no son válidas.' })
    renderSwitcher()
    await openForm()

    fireEvent.change(screen.getByLabelText(/^Correo o DNI/), { target: { value: 'admin@coar.edu.pe' } })
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'mala' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Las credenciales no son válidas.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy()
  })

  it('muestra Conectando mientras espera el login', async () => {
    let resolveLogin
    login.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve
        }),
    )
    renderSwitcher()
    await openForm()

    fireEvent.change(screen.getByLabelText(/^Correo o DNI/), { target: { value: 'admin@coar.edu.pe' } })
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: 'secreto123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('button', { name: /conectando/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /conectando/i }).disabled).toBe(true)
    resolveLogin({ ok: false, message: 'x' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy())
  })

  it('cancela la petición de health al desmontarse', async () => {
    const { unmount } = renderSwitcher()
    await waitFor(() => expect(healthRequest).toHaveBeenCalled())
    const { signal } = healthRequest.mock.calls[0][0]

    unmount()
    expect(signal.aborted).toBe(true)
  })

  it('no renderiza nada fuera del entorno de desarrollo', () => {
    vi.stubEnv('DEV', false)
    const { container } = renderSwitcher()

    expect(container.firstChild).toBeNull()
    expect(healthRequest).not.toHaveBeenCalled()
  })
})
