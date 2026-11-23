import { describe, expect, it } from 'vitest'
import { withQuery } from './query.js'

describe('withQuery', () => {
  it('devuelve la ruta limpia cuando no hay parámetros', () => {
    expect(withQuery('/admin/users')).toBe('/admin/users')
    expect(withQuery('/admin/users', {})).toBe('/admin/users')
  })

  it('omite vacíos, nulos y undefined y conserva texto y números', () => {
    expect(
      withQuery('/admin/users', {
        q: 'ana',
        page: 2,
        role: '',
        classroom_id: null,
        period_id: undefined,
      }),
    ).toBe('/admin/users?q=ana&page=2')
  })

  it('devuelve la ruta limpia si todos los valores son inválidos', () => {
    expect(
      withQuery('/auth/me', {
        token: '',
        user: null,
        extra: undefined,
      }),
    ).toBe('/auth/me')
  })
})
