import { cleanup, render, screen } from '@testing-library/react'
import { BookOpen } from 'lucide-react'
import { afterEach, describe, expect, it } from 'vitest'
import EmptyState from './EmptyState'

afterEach(cleanup)

describe('EmptyState', () => {
  it('muestra el título por defecto', () => {
    render(<EmptyState />)

    expect(screen.getByText('Sin registros para mostrar.')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('muestra descripción, icono personalizado y acción', () => {
    render(
      <EmptyState
        icon={BookOpen}
        title="Aún no hay notas"
        description="Cuando registres evaluaciones aparecerán aquí."
        action={<a href="/notas">Ir a notas</a>}
      />,
    )

    expect(screen.getByText('Aún no hay notas')).toBeTruthy()
    expect(screen.getByText('Cuando registres evaluaciones aparecerán aquí.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir a notas' }).getAttribute('href')).toBe('/notas')
  })
})
