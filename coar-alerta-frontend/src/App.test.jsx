import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./routes/AppRouter', () => ({
  default: () => <div>Router de la aplicación</div>,
}))

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

afterEach(cleanup)

describe('App', () => {
  it('monta el router dentro de los providers de toast y autenticación', () => {
    render(<App />)

    expect(screen.getByText('Router de la aplicación')).toBeTruthy()
  })
})
