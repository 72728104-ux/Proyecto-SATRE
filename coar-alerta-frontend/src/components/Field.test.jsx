import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import Field from './Field'

afterEach(cleanup)

describe('Field', () => {
  it('asocia la etiqueta, el hint y marca el campo requerido', () => {
    render(<Field label="Correo institucional" name="email" type="email" hint="Usa tu correo COAR" required />)

    const input = screen.getByLabelText(/^Correo institucional/)
    const label = screen.getByText(/Correo institucional/)
    expect(input.id).toBe(label.getAttribute('for'))
    expect(input.getAttribute('name')).toBe('email')
    expect(input.getAttribute('type')).toBe('email')
    expect(input.required).toBe(true)
    expect(input.getAttribute('aria-describedby')).toBe(`${input.id}-hint`)
    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(screen.getByText('Usa tu correo COAR')).toBeTruthy()
    expect(label.textContent).toContain('*')
  })

  it('muestra el primer mensaje cuando el error es una lista', () => {
    render(<Field label="Correo" name="email" error={['El correo es obligatorio.', 'Otro error']} hint="Ayuda" />)

    const input = screen.getByLabelText(/^Correo/)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe(`${input.id}-error`)
    expect(screen.getByText('El correo es obligatorio.')).toBeTruthy()
    expect(screen.queryByText('Otro error')).toBeNull()
    expect(screen.queryByText('Ayuda')).toBeNull()
  })

  it('acepta un error de texto', () => {
    render(<Field label="Correo" name="email" error="Requerido" />)

    expect(screen.getByText('Requerido')).toBeTruthy()
    expect(screen.getByLabelText(/^Correo/).getAttribute('aria-invalid')).toBe('true')
  })

  it('permite un id explícito y un addon junto a la etiqueta', () => {
    render(<Field label="Correo" name="email" id="correo-id" labelAddon={<span>Solo dev</span>} />)

    expect(screen.getByLabelText(/^Correo/).id).toBe('correo-id')
    expect(screen.getByText('Solo dev')).toBeTruthy()
  })

  it('renderiza un sufijo junto al control', () => {
    render(<Field label="Monto" name="amount" suffix={<span>S/.</span>} />)

    expect(screen.getByLabelText(/^Monto/)).toBeTruthy()
    expect(screen.getByText('S/.')).toBeTruthy()
  })

  it('funciona como select con opciones', () => {
    render(
      <Field as="select" label="Rol" name="role">
        <option value="admin">Admin</option>
        <option value="tutor">Tutor</option>
      </Field>,
    )

    const select = screen.getByRole('combobox', { name: /^Rol/ })
    expect(select.getAttribute('name')).toBe('role')
    expect(screen.getByRole('option', { name: 'Admin' })).toBeTruthy()
  })

  it('no renderiza etiqueta cuando no se entrega label', () => {
    const { container } = render(<Field name="solo" aria-label="Solo" />)

    expect(container.querySelector('label')).toBeNull()
    expect(screen.getByLabelText('Solo')).toBeTruthy()
  })
})
