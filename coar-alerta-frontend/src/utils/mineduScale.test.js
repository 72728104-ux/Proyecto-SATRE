import { describe, expect, it } from 'vitest'
import {
  MAX_SCORE,
  MIN_SCORE,
  PASSING_SCORE,
  formatScore,
  formatScoreWithLiteral,
  isValidScore,
  normalizeScore,
  parseScore,
  toLiteral,
} from './mineduScale'

describe('mineduScale', () => {
  it('acepta decimales de 0.00 a 20.00 y rechaza el rango IB 1–7 entero', () => {
    expect(MIN_SCORE).toBe(0)
    expect(MAX_SCORE).toBe(20)
    expect(PASSING_SCORE).toBe(11)
    expect(isValidScore('16.5')).toBe(true)
    expect(isValidScore('16,5')).toBe(true)
    expect(isValidScore(0)).toBe(true)
    expect(isValidScore(20)).toBe(true)
    expect(isValidScore(20.01)).toBe(false)
    expect(isValidScore(-0.01)).toBe(false)
    expect(isValidScore('')).toBe(false)
    expect(normalizeScore('16.555')).toBeCloseTo(16.56, 2)
  })

  it('mapea bandas oficiales AD/A/B/C', () => {
    expect(toLiteral(20)).toBe('AD')
    expect(toLiteral(18)).toBe('AD')
    expect(toLiteral(17.99)).toBe('A')
    expect(toLiteral(16.5)).toBe('A')
    expect(toLiteral(15)).toBe('A')
    expect(toLiteral(14.99)).toBe('B')
    expect(toLiteral(11)).toBe('B')
    expect(toLiteral(10.99)).toBe('C')
    expect(toLiteral(0)).toBe('C')
    expect(toLiteral(21)).toBeNull()
    expect(toLiteral('')).toBeNull()
    expect(parseScore('no')).toBeNull()
  })

  it('formatea vigesimal con letra, p. ej. 16.5 (A)', () => {
    expect(formatScore(16.5)).toBe('16.5')
    expect(formatScoreWithLiteral(16.5)).toBe('16.5 (A)')
    expect(formatScoreWithLiteral(19, 'AD')).toBe('19 (AD)')
    expect(formatScoreWithLiteral(null)).toBe('—')
  })
})
