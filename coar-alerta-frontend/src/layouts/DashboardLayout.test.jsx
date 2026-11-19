import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardLayout from './DashboardLayout'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}))
vi.mock('../components/Navbar', () => ({
  default: ({ onMenu }) => (
    <button type="button" onClick={onMenu}>
      Abrir menú
    </button>
  ),
}))

let authState

beforeEach(() => {
  authState = { role: 'estudiante', collegeHasResidence: true }
})

afterEach(cleanup)

function renderLayout(element = <div>Panel del rol</div>) {
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/app" element={element} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('DashboardLayout', () => {
  it('compone sidebar, navbar y el outlet', () => {
    renderLayout()

    expect(screen.getByText('Panel del rol')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeTruthy()
    expect(screen.getByText('COAR Junín')).toBeTruthy()
    expect(screen.getByText('Sistema de alerta temprana')).toBeTruthy()
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === '/estudiante')).toBe(true)
  })

  it('abre y cierra el sidebar en móvil', () => {
    const { container } = renderLayout()
    const aside = container.querySelector('aside')
    expect(aside.className).toContain('-translate-x-full')

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
    expect(aside.className).toContain('translate-x-0')

    const overlay = container.querySelector('button[class*="inset-0"]')
    expect(overlay).toBeTruthy()
    fireEvent.click(overlay)
    expect(aside.className).toContain('-translate-x-full')
  })

  it('oculta los accesos de residencia cuando el colegio no tiene internado', () => {
    authState = { role: 'estudiante', collegeHasResidence: false }
    renderLayout()

    expect(screen.queryByText('Permisos')).toBeNull()
    expect(screen.getByText('Calificaciones')).toBeTruthy()
  })

  it('muestra el ErrorBoundary y recupera el outlet al reintentar', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    let shouldThrow = true

    function Boom() {
      if (shouldThrow) {
        throw new Error('Boom')
      }
      return <div>Contenido recuperado</div>
    }

    renderLayout(<Boom />)

    expect(screen.getByText(/Ocurrió un error al procesar la respuesta/)).toBeTruthy()

    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(screen.getByText('Contenido recuperado')).toBeTruthy()
    consoleError.mockRestore()
  })
})
