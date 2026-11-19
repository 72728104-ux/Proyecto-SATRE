import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Forbidden from './Forbidden'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}))

const logout = vi.fn()
let authState

beforeEach(() => {
  logout.mockReset()
  authState = { role: 'tutor', logout }
})

afterEach(cleanup)

const renderForbidden = (props = {}) =>
  render(
    <MemoryRouter>
      <Forbidden {...props} />
    </MemoryRouter>,
  )

describe('Forbidden', () => {
  it('muestra el mensaje por defecto y el enlace al home del rol', () => {
    renderForbidden()

    expect(screen.getByText('Error 403')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Acceso denegado' })).toBeTruthy()
    expect(screen.getByText('No tienes permiso para ver esta sección.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir a mi inicio' }).getAttribute('href')).toBe('/tutor')
  })

  it('acepta un mensaje personalizado y oculta el inicio si el rol no tiene home', () => {
    authState = { role: 'desconocido', logout }
    renderForbidden({ message: 'Tu cuenta no tiene un rol habilitado en SATRE.' })

    expect(screen.getByText('Tu cuenta no tiene un rol habilitado en SATRE.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Ir a mi inicio' })).toBeNull()
  })

  it('cierra sesión al pulsar el botón', () => {
    renderForbidden()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(logout).toHaveBeenCalledTimes(1)
  })
})
