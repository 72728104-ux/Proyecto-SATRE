import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

afterEach(cleanup)

function Boom() {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  it('muestra un fallback en lugar de colapsar la vista', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary title="IA Tutor">
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('IA Tutor')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
    spy.mockRestore()
  })
})
