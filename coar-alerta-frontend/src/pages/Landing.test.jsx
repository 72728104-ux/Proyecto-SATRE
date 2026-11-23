import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Landing from './Landing'

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  )
}

describe('Landing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('muestra el portal institucional con logo, historia, misión, noticias e indicadores', () => {
    renderLanding()

    expect(screen.getAllByLabelText('Colegio de Alto Rendimiento Junín').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Excelencia pública/i)
    expect(screen.getByRole('heading', { name: 'Historia institucional' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Misión, visión y valores' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Noticias y comunicados' })).toBeTruthy()
    expect(screen.getByText('C.R.E.A.T.E.')).toBeTruthy()
    expect(screen.getByText('Estudiantes')).toBeTruthy()
    expect(screen.getByText('Docentes')).toBeTruthy()
    expect(screen.queryByText(/versión de prueba/i)).toBeNull()
    expect(screen.queryByText(/fase test/i)).toBeNull()
    expect(screen.queryByText(/\bDemo\b/)).toBeNull()
  })

  it('lleva a /login desde Acceso a la Plataforma', () => {
    renderLanding()
    const links = screen.getAllByRole('link', { name: /Acceso a la Plataforma/i })
    expect(links.length).toBeGreaterThan(0)
    expect(links.every((link) => link.getAttribute('href') === '/login')).toBe(true)
  })

  it('rota el banner hero al pulsar siguiente', () => {
    renderLanding()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Excelencia pública/i)
    fireEvent.click(screen.getByRole('button', { name: 'Banner siguiente' }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Aprendizaje exigente/i)
  })
})
