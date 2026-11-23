import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MermaidDiagram from './MermaidDiagram.jsx'
import { sanitizeMermaidChart } from './sanitizeMermaid.js'

const { mermaid } = vi.hoisted(() => ({
  mermaid: {
    initialize: vi.fn(),
    render: vi.fn(),
  },
}))

vi.mock('mermaid', () => ({
  default: mermaid,
}))

describe('sanitizeMermaidChart', () => {
  it('encierra entre comillas nodos con paréntesis', () => {
    expect(sanitizeMermaidChart('flowchart TD\n    A[Inicio (x1, y1)] --> B[Fin]')).toBe(
      'flowchart TD\n    A["Inicio (x1, y1)"] --> B[Fin]',
    )
  })

  it('quita fences y caracteres que rompen el parser', () => {
    expect(sanitizeMermaidChart('```mermaid\nflowchart TD\n    A[Inicio "x1"] --> B[Fin]\n```')).toBe(
      'flowchart TD\n    A["Inicio x1"] --> B[Fin]',
    )
  })

  it('no duplica comillas y deja nodos simples intactos', () => {
    const quoted = 'flowchart TD\n    A["Inicio (x1, y1)"] --> B[Fin]'
    const plain = 'flowchart TD\n    A[Δy] --> M[pendiente]'
    expect(sanitizeMermaidChart(quoted)).toBe(quoted)
    expect(sanitizeMermaidChart(plain)).toBe(plain)
  })
})

describe('MermaidDiagram', () => {
  afterEach(() => {
    cleanup()
    mermaid.render.mockReset()
  })

  it('renderiza el SVG sanitizado', async () => {
    mermaid.render.mockResolvedValue({ svg: '<svg data-ok="1"></svg>' })
    render(<MermaidDiagram chart="flowchart TD\n    A[Inicio (x1, y1)] --> B[Fin]" />)
    await waitFor(() => {
      expect(document.querySelector('[data-cy="tutor-mermaid"]')).toBeTruthy()
    })
    expect(mermaid.render).toHaveBeenCalled()
    expect(mermaid.render.mock.calls[0][0]).toMatch(/^tutor-mermaid-/)
    expect(mermaid.render.mock.calls[0][1]).toContain('A["Inicio (x1, y1)"]')
    expect(mermaid.render.mock.calls[0][1]).not.toContain('A[Inicio (x1, y1)]')
  })

  it('muestra una vista limpia si mermaid.render falla', async () => {
    mermaid.render.mockRejectedValue(new Error('Syntax error in text - mermaid version 12.1.0'))
    render(<MermaidDiagram chart="flowchart TD\n    A[broken" />)
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('No se pudo mostrar el diagrama.')
    })
    expect(screen.queryByText(/Syntax error in text/)).toBeNull()
  })
})
