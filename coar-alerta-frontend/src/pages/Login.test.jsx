import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Login from './Login'

const login = vi.fn()

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login,
    logoutReason: null,
  }),
}))

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
}

describe('Login', () => {
  afterEach(() => {
    cleanup()
    login.mockReset()
  })

  it('acepta correo institucional o DNI en el mismo campo', async () => {
    login.mockResolvedValue({ ok: false, message: 'Las credenciales no son válidas.', fieldErrors: {} })
    renderLogin()

    const identifier = screen.getByLabelText(/correo institucional o dni/i)
    expect(identifier.getAttribute('type')).toBe('text')

    fireEvent.change(identifier, { target: { value: '78901234' } })
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'coar2026' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar al sistema/i }))

    expect(login).toHaveBeenCalledWith('78901234', 'coar2026')
  })
})
