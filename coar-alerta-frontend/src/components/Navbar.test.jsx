import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Navbar from './Navbar'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}))
vi.mock('./RoleSwitcher', () => ({
  default: () => <span>Cambiar cuenta mock</span>,
}))

const logout = vi.fn()
let authState

beforeEach(() => {
  logout.mockReset()
  authState = {
    user: { name: 'Ana Torres', cargo: 'Docente / Tutor' },
    roleLabel: 'Docente / Tutor',
    logout,
  }
})

afterEach(cleanup)

const renderNavbar = (props = {}) =>
  render(
    <MemoryRouter>
      <Navbar {...props} />
    </MemoryRouter>,
  )

describe('Navbar', () => {
  it('muestra el rol y los datos del usuario', () => {
    renderNavbar()

    expect(screen.getAllByText('Docente / Tutor')).toHaveLength(2)
    expect(screen.getByText('Ana Torres')).toBeTruthy()
    expect(screen.getByText('Cambiar cuenta mock')).toBeTruthy()
  })

  it('abre el menú lateral desde el botón de menú', () => {
    const onMenu = vi.fn()
    const { container } = renderNavbar({ onMenu })

    fireEvent.click(container.querySelector('header button'))
    expect(onMenu).toHaveBeenCalledTimes(1)
  })

  it('no falla al pulsar el menú si no hay handler', () => {
    const { container } = renderNavbar()

    expect(() => fireEvent.click(container.querySelector('header button'))).not.toThrow()
  })

  it('expone las acciones de notificaciones y cierre de sesión', () => {
    renderNavbar()

    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('tolera un usuario sin datos cargados', () => {
    authState = { ...authState, user: null }

    expect(() => renderNavbar()).not.toThrow()
  })
})
