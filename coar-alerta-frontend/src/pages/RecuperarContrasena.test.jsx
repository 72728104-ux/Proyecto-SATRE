import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RecuperarContrasena from './RecuperarContrasena'
import { forgotPasswordRequest } from '../api/auth'

vi.mock('../api/auth', () => ({ forgotPasswordRequest: vi.fn() }))

function renderPage() {
  return render(
    <MemoryRouter>
      <RecuperarContrasena />
    </MemoryRouter>,
  )
}

const emailField = () => screen.getByLabelText(/^Correo institucional/)

describe('RecuperarContrasena', () => {
  afterEach(() => {
    cleanup()
    forgotPasswordRequest.mockReset()
  })

  it('muestra el formulario con el enlace de vuelta al login', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Recuperar contraseña' })).toBeTruthy()
    expect(screen.getByText(/enlace válido por 60 minutos/i)).toBeTruthy()
    expect(emailField().getAttribute('type')).toBe('email')
    expect(screen.getByRole('link', { name: /volver al inicio de sesión/i }).getAttribute('href')).toBe('/login')
  })

  it('solicita el enlace de recuperacion al enviar el correo', async () => {
    forgotPasswordRequest.mockResolvedValue({ ok: true, message: 'ok' })
    renderPage()

    fireEvent.change(emailField(), { target: { value: 'estudiante@coar.edu.pe' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar enlace/i }))

    await waitFor(() => expect(forgotPasswordRequest).toHaveBeenCalledWith('estudiante@coar.edu.pe'))
    expect(screen.getByText(/para restablecer tu contrase/i)).toBeTruthy()
    expect(screen.queryByLabelText(/^Correo institucional/)).toBeNull()
    expect(screen.queryByRole('button', { name: /enviar enlace/i })).toBeNull()
  })

  it('muestra el mensaje de error general cuando falla la peticion', async () => {
    forgotPasswordRequest.mockRejectedValue({ message: 'No se pudo enviar el correo.' })
    renderPage()

    fireEvent.change(emailField(), { target: { value: 'estudiante@coar.edu.pe' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar enlace/i }))

    expect(await screen.findByText('No se pudo enviar el correo.')).toBeTruthy()
    expect(emailField()).toBeTruthy()
  })

  it('muestra el error por campo del correo sin duplicar el error general', async () => {
    forgotPasswordRequest.mockRejectedValue({ message: 'Datos inválidos.', fieldErrors: { email: 'El correo no es válido.' } })
    renderPage()

    fireEvent.change(emailField(), { target: { value: 'no-es-correo' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar enlace/i }))

    expect(await screen.findByText('El correo no es válido.')).toBeTruthy()
    expect(screen.queryByText('Datos inválidos.')).toBeNull()
    expect(emailField().getAttribute('aria-invalid')).toBe('true')
  })

  it('deshabilita el boton y muestra Enviando mientras espera la respuesta', async () => {
    let resolveRequest
    forgotPasswordRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve
        }),
    )
    renderPage()

    fireEvent.change(emailField(), { target: { value: 'estudiante@coar.edu.pe' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar enlace/i }))

    expect(await screen.findByRole('button', { name: /enviando/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /enviando/i }).disabled).toBe(true)
    resolveRequest({ ok: true })
    await waitFor(() => expect(screen.getByText(/recibirás un enlace/i)).toBeTruthy())
  })
})
