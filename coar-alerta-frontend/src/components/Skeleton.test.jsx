import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import Skeleton, { SkeletonList } from './Skeleton'

afterEach(cleanup)

describe('Skeleton', () => {
  it('es decorativo y acepta clases adicionales', () => {
    const { container } = render(<Skeleton className="h-10 w-1/2" />)
    const skeleton = container.firstChild

    expect(skeleton.getAttribute('aria-hidden')).toBe('true')
    expect(skeleton.className).toContain('animate-pulse')
    expect(skeleton.className).toContain('h-10')
    expect(skeleton.className).toContain('w-1/2')
  })
})

describe('SkeletonList', () => {
  it('muestra cinco filas por defecto con un estado accesible', () => {
    const { container } = render(<SkeletonList />)

    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('Cargando…')).toBeTruthy()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(10)
  })

  it('permite definir la cantidad de filas', () => {
    const { container } = render(<SkeletonList rows={2} />)

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)
  })
})
