import { describe, expect, it } from 'vitest'
import { extractErrorMessage, extractFieldErrors } from '../api/client.js'

const laravel422 = {
  message: 'The given data was invalid.',
  errors: {
    email: ['El correo es obligatorio.', 'El correo no es válido.'],
    password: ['La contraseña debe tener al menos 10 caracteres.'],
    'profile.dni': 'El DNI ya está registrado.',
  },
}

describe('extractFieldErrors', () => {
  it('aplana el payload 422 de Laravel a un mensaje por campo', () => {
    expect(extractFieldErrors(laravel422)).toEqual({
      email: 'El correo es obligatorio.',
      password: 'La contraseña debe tener al menos 10 caracteres.',
      'profile.dni': 'El DNI ya está registrado.',
    })
  })

  it('acepta errors como string, lista vacía y campos anidados', () => {
    expect(
      extractFieldErrors({
        errors: {
          name: 'Requerido',
          notes: [],
          'students.0.id': ['No existe el estudiante.'],
        },
      }),
    ).toEqual({
      name: 'Requerido',
      notes: undefined,
      'students.0.id': 'No existe el estudiante.',
    })
  })

  it('devuelve objeto vacío si no hay errors o el payload es nulo', () => {
    expect(extractFieldErrors(undefined)).toEqual({})
    expect(extractFieldErrors(null)).toEqual({})
    expect(extractFieldErrors({})).toEqual({})
    expect(extractFieldErrors({ message: 'Revisa los datos ingresados.' })).toEqual({})
    expect(extractFieldErrors({ errors: {} })).toEqual({})
  })
})

describe('extractErrorMessage con 422 de Laravel', () => {
  it('concatena errors cuando el payload trae ambos message y errors', () => {
    expect(extractErrorMessage(laravel422, 422)).toBe(
      'El correo es obligatorio. El correo no es válido. La contraseña debe tener al menos 10 caracteres. El DNI ya está registrado.',
    )
  })

  it('usa el message de Laravel cuando no hay errors', () => {
    expect(extractErrorMessage({ message: 'The given data was invalid.' }, 422)).toBe(
      'The given data was invalid.',
    )
  })

  it('cae al texto por status si el 422 viene vacío', () => {
    expect(extractErrorMessage({}, 422)).toBe('Revisa los datos ingresados.')
    expect(extractErrorMessage({ message: 12 }, 500)).toBe(12)
  })
})
