import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Pagination from './Pagination'

afterEach(cleanup)

const meta = (overrides = {}) => ({
  current_page: 5,
  last_page: 10,
  total: 95,
  from: 41,
  to: 50,
  ...overrides,
})

const renderPagination = (props = {}) =>
  render(<Pagination meta={meta()} onPageChange={vi.fn()} {...props} />)

describe('Pagination', () => {
  it('no renderiza nada si no hay paginación o solo hay una página', () => {
    const { container, rerender } = render(<Pagination meta={null} onPageChange={vi.fn()} />)
    expect(container.firstChild).toBeNull()

    rerender(<Pagination meta={{ last_page: 1 }} onPageChange={vi.fn()} />)
    expect(container.firstChild).toBeNull()

    rerender(<Pagination meta={{}} onPageChange={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('muestra el rango y una ventana de páginas con elipsis', () => {
    const { container } = renderPagination()

    expect(screen.getByText('Mostrando 41–50 de 95')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeTruthy()
    ;['1', '4', '5', '6', '10'].forEach((page) => {
      expect(screen.getByRole('button', { name: page })).toBeTruthy()
    })
    expect(screen.queryByRole('button', { name: '2' })).toBeNull()
    expect(screen.getAllByText('…')).toHaveLength(2)
    expect(container.querySelector('[aria-current="page"]').textContent).toBe('5')
  })

  it('usa guiones cuando faltan from y to', () => {
    renderPagination({ meta: meta({ from: undefined, to: undefined, total: 0 }) })

    expect(screen.getByText(/Mostrando/).textContent).toBe('Mostrando ––– de 0')
  })

  it('navega con las páginas, anterior y siguiente', () => {
    const onPageChange = vi.fn()
    renderPagination({ onPageChange })

    fireEvent.click(screen.getByRole('button', { name: '6' }))
    expect(onPageChange).toHaveBeenLastCalledWith(6)

    fireEvent.click(screen.getByRole('button', { name: /anterior/i }))
    expect(onPageChange).toHaveBeenLastCalledWith(4)

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(onPageChange).toHaveBeenLastCalledWith(6)

    fireEvent.click(screen.getByRole('button', { name: '5' }))
    expect(onPageChange).toHaveBeenCalledTimes(3)
  })

  it('deshabilita anterior en la primera página y siguiente en la última', () => {
    const { rerender } = renderPagination({ meta: meta({ current_page: 1, from: 1, to: 10 }) })
    expect(screen.getByRole('button', { name: /anterior/i }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /siguiente/i }).disabled).toBe(false)

    rerender(<Pagination meta={meta({ current_page: 10, from: 91, to: 95 })} onPageChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /anterior/i }).disabled).toBe(false)
    expect(screen.getByRole('button', { name: /siguiente/i }).disabled).toBe(true)
  })

  it('deshabilita todos los controles cuando disabled es true', () => {
    renderPagination({ disabled: true })

    screen.getAllByRole('button').forEach((button) => {
      expect(button.disabled).toBe(true)
    })
  })
})
