import { cleanup, render, screen } from '@testing-library/react'
import { Shield } from 'lucide-react'
import { afterEach, describe, expect, it } from 'vitest'
import StatCard from './StatCard'

afterEach(cleanup)

describe('StatCard', () => {
  it('muestra etiqueta, valor y pista con el tono por defecto', () => {
    const { container } = render(<StatCard label="Alertas activas" value={12} hint="Últimos 7 días" />)

    expect(screen.getByText('Alertas activas')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('Últimos 7 días')).toBeTruthy()
    expect(container.firstChild.className).toContain('from-navy-800')
    expect(container.querySelector('svg')).toBeNull()
  })

  it('renderiza el icono y el tono slate', () => {
    const { container } = render(<StatCard icon={Shield} label="Riesgo" value="Bajo" tone="slate" />)

    expect(container.firstChild.className).toContain('from-slate-100')
    expect(container.querySelector('svg')).not.toBeNull()
    expect(screen.getByText('Bajo')).toBeTruthy()
  })

  it('omite la pista cuando no se entrega', () => {
    render(<StatCard label="Solo" value={0} />)

    expect(screen.getByText('Solo')).toBeTruthy()
    expect(screen.getByText('0')).toBeTruthy()
    expect(document.querySelectorAll('p')).toHaveLength(2)
  })

  it('acepta un valor de texto largo', () => {
    render(<StatCard label="Periodo" value="2026-I" tone="teal" />)

    expect(screen.getByText('2026-I')).toBeTruthy()
  })
})
