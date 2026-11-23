import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import AlertBadge from './AlertBadge'

afterEach(cleanup)

describe('AlertBadge', () => {
  it('usa la severidad normal por defecto', () => {
    render(<AlertBadge />)

    expect(screen.getByText('Normal')).toBeTruthy()
  })

  it.each([
    ['critico', 'Crítico', 'bg-rose-100'],
    ['alto', 'Alto', 'bg-orange-100'],
    ['medio', 'Medio', 'bg-amber-100'],
    ['pendiente_apoderado', 'Pendiente apoderado', 'bg-sky-100'],
    ['pendiente_residencia', 'Pendiente residencia', 'bg-indigo-100'],
    ['autorizado', 'Autorizado', 'bg-emerald-100'],
    ['observado', 'Observado', 'bg-amber-100'],
    ['presente', 'Presente', 'bg-emerald-100'],
    ['falta', 'Falta', 'bg-rose-100'],
    ['tardanza', 'Tardanza', 'bg-amber-100'],
    ['justified', 'Justificado', 'bg-sky-100'],
    ['absent_justified', 'Falta justificada', 'bg-sky-100'],
    ['absent_unjustified', 'Falta injustificada', 'bg-rose-100'],
    ['ausente', 'Ausente', 'bg-rose-100'],
    ['permiso', 'Con permiso', 'bg-sky-100'],
  ])('etiqueta y estiliza el nivel %s', (nivel, label, tone) => {
    render(<AlertBadge nivel={nivel} />)

    const badge = screen.getByText(label)
    expect(badge.className).toContain(tone)
    expect(badge.className).toContain('rounded-full')
  })

  it('acepta contenido personalizado', () => {
    render(<AlertBadge nivel="alto">Prioridad alta</AlertBadge>)

    expect(screen.getByText('Prioridad alta')).toBeTruthy()
    expect(screen.queryByText('Alto')).toBeNull()
  })

  it('cae al estilo normal con niveles desconocidos', () => {
    render(<AlertBadge nivel="desconocido" />)

    const badge = screen.getByText('desconocido')
    expect(badge.className).toContain('bg-emerald-100')
  })
})
