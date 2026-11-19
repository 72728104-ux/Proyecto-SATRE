import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import CoarLogo from './CoarLogo'

afterEach(cleanup)

describe('CoarLogo', () => {
  it('renderiza el logo con el título accesible y tamaño por defecto', () => {
    render(<CoarLogo />)

    const logo = screen.getByRole('img', { name: 'Colegio de Alto Rendimiento Junín' })
    expect(logo.getAttribute('width')).toBe('48')
    expect(logo.getAttribute('height')).toBe('48')
    expect(logo.getAttribute('viewBox')).toBe('0 0 64 64')
    expect(logo.getAttribute('class')).toBe('')
  })

  it('permite ajustar tamaño, título y clases', () => {
    render(<CoarLogo size={32} title="Logo SATRE" className="text-white" />)

    const logo = screen.getByRole('img', { name: 'Logo SATRE' })
    expect(logo.getAttribute('width')).toBe('32')
    expect(logo.getAttribute('height')).toBe('32')
    expect(logo.getAttribute('class')).toBe('text-white')
  })
})
