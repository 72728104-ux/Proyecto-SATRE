import { describe, expect, it } from 'vitest'
import { rowErrorsFrom } from './rows'

describe('rowErrorsFrom', () => {
  it('mapea records.N.campo al id del estudiante correspondiente', () => {
    const fieldErrors = {
      'records.0.notes': 'La nota es obligatoria.',
      'records.1.notes': 'La nota excede el máximo.',
      'records.1.criterion': 'Criterio inválido.',
    }

    expect(rowErrorsFrom(fieldErrors, [11, 22])).toEqual({
      11: { notes: 'La nota es obligatoria.' },
      22: { notes: 'La nota excede el máximo.', criterion: 'Criterio inválido.' },
    })
  })

  it('ignora claves que no siguen el patrón records.N.campo', () => {
    const result = rowErrorsFrom(
      {
        email: 'Requerido',
        'records.0': 'Sin campo',
        'records.x.notes': 'Índice inválido',
        'records.0.notes.extra': 'Demasiados segmentos',
        'records.0.notes': 'Válido',
      },
      [7],
    )

    expect(result).toEqual({ 7: { notes: 'Válido' } })
  })

  it('ignora índices que no existen en la lista de estudiantes', () => {
    expect(rowErrorsFrom({ 'records.5.notes': 'Fuera de rango' }, [1, 2])).toEqual({})
    expect(rowErrorsFrom({ 'records.0.notes': 'Sin estudiantes' }, [])).toEqual({})
  })

  it('tolera fieldErrors nulo o indefinido', () => {
    expect(rowErrorsFrom(undefined, [1])).toEqual({})
    expect(rowErrorsFrom(null, [1])).toEqual({})
    expect(rowErrorsFrom({}, [1])).toEqual({})
  })
})
