import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ScoreBadge, { MineduLiteralBadge } from './ScoreBadge'

afterEach(cleanup)

describe('ScoreBadge', () => {
  it('muestra la nota vigesimal junto a la letra Minedu', () => {
    render(<ScoreBadge value={16.5} />)
    expect(screen.getByText('16.5 (A)')).toBeTruthy()
  })

  it('usa el literal del API cuando viene informado', () => {
    render(<ScoreBadge value={19} literal="AD" />)
    expect(screen.getByText('19 (AD)')).toBeTruthy()
  })
})

describe('MineduLiteralBadge', () => {
  it('previsualiza la letra al escribir una nota válida', () => {
    render(<MineduLiteralBadge score="16.5" />)
    expect(screen.getByText('A')).toBeTruthy()
  })
})
