import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NotFound from './NotFound'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ homePath }),
}))

let homePath = '/estudiante'

afterEach(cleanup)

describe('NotFound', () => {
  it('muestra el 404 y el enlace al home del usuario', () => {
    homePath = '/estudiante'
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    )

    expect(screen.getByText('Error 404')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeTruthy()
    expect(screen.getByText('La dirección no existe o fue movida.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe('/estudiante')
  })

  it('usa el homePath actual del contexto', () => {
    homePath = '/admin'
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe('/admin')
  })
})
