import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DataTable from './DataTable'

function mockMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

const columns = [
  { key: 'name', header: 'Nombre', primary: true },
  { key: 'grade', header: 'Nota', mobileLabel: 'Calificación', render: (row) => <strong>{row.grade}</strong> },
  { key: 'secret', header: 'Interno', hideOnMobile: true },
]

const rows = [
  { id: 1, name: 'Ana', grade: 16, secret: 'solo desktop' },
  { id: 2, name: 'Luis', grade: 12, secret: 'otro' },
]

describe('DataTable', () => {
  beforeEach(() => {
    mockMatchMedia(true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renderiza la tabla con columnas y render personalizado en escritorio', () => {
    render(<DataTable columns={columns} rows={rows} />)

    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Nota' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Interno' })).toBeTruthy()
    expect(screen.getByText('Ana')).toBeTruthy()
    expect(screen.getByText('16').tagName).toBe('STRONG')
    expect(screen.getAllByText('solo desktop')).toHaveLength(1)
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })

  it('en móvil usa la columna primaria como título y oculta las columnas marcadas', () => {
    mockMatchMedia(false)
    render(<DataTable columns={columns} rows={rows} />)

    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Ana')).toBeTruthy()
    expect(screen.getAllByText('Calificación')).toHaveLength(2)
    expect(screen.queryByText('Interno')).toBeNull()
    expect(screen.queryByText('solo desktop')).toBeNull()
  })

  it('usa la primera columna como primaria si ninguna la define', () => {
    mockMatchMedia(false)
    render(<DataTable columns={columns.map((column) => ({ ...column, primary: false }))} rows={rows} />)

    expect(screen.getByText('Ana').tagName).toBe('DIV')
  })

  it('no muestra el bloque de detalles si todas las columnas se ocultan en móvil', () => {
    mockMatchMedia(false)
    const { container } = render(
      <DataTable columns={[{ key: 'name', header: 'Nombre' }, { key: 'secret', header: 'Interno', hideOnMobile: true }]} rows={rows} />,
    )

    expect(container.querySelector('dl')).toBeNull()
  })

  it('muestra el estado vacío por defecto y personalizado', () => {
    const { rerender } = render(<DataTable columns={columns} rows={[]} />)
    expect(screen.getByText('Sin registros para mostrar.')).toBeTruthy()

    rerender(<DataTable columns={columns} rows={[]} empty="Nada por aquí" />)
    expect(screen.getByText('Nada por aquí')).toBeTruthy()

    rerender(<DataTable columns={columns} rows={[]} empty={<div>Vacío personalizado</div>} />)
    expect(screen.getByText('Vacío personalizado')).toBeTruthy()
  })

  it('muestra el esqueleto de carga y no las filas', () => {
    render(<DataTable columns={columns} rows={rows} loading />)

    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('Cargando…')).toBeTruthy()
    expect(screen.queryByText('Ana')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('respeta keyField para las filas', () => {
    mockMatchMedia(true)
    render(
      <DataTable
        columns={columns}
        keyField="student_id"
        rows={rows.map((row, index) => ({ ...row, student_id: index + 10 }))}
      />,
    )

    expect(screen.getAllByRole('row')).toHaveLength(3)
  })
})
