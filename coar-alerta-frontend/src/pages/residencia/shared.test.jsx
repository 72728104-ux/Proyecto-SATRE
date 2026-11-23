import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHECK_TYPES,
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITY,
  INCIDENT_STATUS,
  OptionList,
  PERMISSION_STATUS,
  PRESENCE_STATUS,
  ResidentPicker,
  StatusBadge,
  formatDate,
  formatDateTime,
  labelOf,
  localDate,
  localDateTime,
  mapOptions,
} from './shared'
import { fetchResidents } from '../../api/residence'

vi.mock('../../api/residence', () => ({ fetchResidents: vi.fn() }))

const residents = [
  {
    id: 3,
    student_code: 'EST-0003',
    first_name: 'Valeria',
    last_name: 'Chávez Poma',
    classroom: { id: 1, name: '5to A' },
  },
  { id: 4, student_code: 'EST-0004', first_name: 'Luis', last_name: 'Quispe' },
]

describe('residencia/shared', () => {
  beforeEach(() => {
    fetchResidents.mockResolvedValue({ data: residents })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('labelOf y mapOptions traducen los catálogos', () => {
    expect(labelOf(CHECK_TYPES, 'night')).toBe('Nocturno')
    expect(labelOf(CHECK_TYPES, 'desconocido')).toBe('desconocido')
    expect(mapOptions(PRESENCE_STATUS)).toEqual([
      { value: 'present', label: 'Presente' },
      { value: 'absent', label: 'Ausente' },
      { value: 'on_permission', label: 'Con permiso' },
    ])
    expect(mapOptions(INCIDENT_SEVERITY).map((item) => item.value)).toEqual(['leve', 'moderada', 'grave'])
    expect(INCIDENT_STATUS.open.label).toBe('Abierta')
    expect(PERMISSION_STATUS.approved_guardian.label).toBe('Por resolver')
    expect(INCIDENT_CATEGORIES[0]).toEqual({ value: 'conducta', label: 'Conducta' })
  })

  it('localDate/localDateTime usan la fecha local sin desfase UTC', () => {
    const date = new Date('2026-04-10T23:30:00')
    expect(localDate(date)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(localDateTime(date)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(localDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(localDate(date).slice(0, 7)).toBe('2026-04')
  })

  it('formatDate y formatDateTime toleran valores vacíos', () => {
    expect(formatDate('2026-04-10')).toContain('2026')
    expect(formatDate(null)).toBe('—')
    expect(formatDate('')).toBe('—')
    expect(formatDateTime('2026-04-10T15:30:00')).toContain('10/04/26')
    expect(formatDateTime(null)).toBe('—')
  })

  it('OptionList renderiza value/label y StatusBadge traduce el estado', () => {
    const { container } = render(
      <div>
        <select>
          <OptionList options={CHECK_TYPES} />
        </select>
        <StatusBadge map={PRESENCE_STATUS} value="absent" />
        <StatusBadge map={PRESENCE_STATUS} value="estado_raro" />
        <StatusBadge map={PRESENCE_STATUS} value={undefined} />
      </div>,
    )

    const options = screen.getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['Nocturno', 'Matutino'])
    expect(screen.getByText('Ausente')).toBeTruthy()
    expect(screen.getByText('estado_raro')).toBeTruthy()
    expect(container.querySelectorAll('.rounded-full')).toHaveLength(3)
  })

  it('ResidentPicker busca internos y devuelve el id seleccionado', async () => {
    const onChange = vi.fn()
    render(<ResidentPicker value={null} onChange={onChange} />)

    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Chávez Poma, Valeria · EST-0003 · 5to A/ })).toBeTruthy(),
    )
    expect(fetchResidents).toHaveBeenCalledWith({ search: '' }, expect.objectContaining({ signal: expect.anything() }))
    expect(screen.getByRole('option', { name: /Quispe, Luis · EST-0004/ })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o código…'), { target: { value: 'val' } })
    await waitFor(() =>
      expect(fetchResidents).toHaveBeenLastCalledWith({ search: 'val' }, expect.anything()),
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '3' } })
    expect(onChange).toHaveBeenCalledWith(3)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('ResidentPicker muestra el placeholder de carga y el error del campo', async () => {
    let resolveFetch
    fetchResidents.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve }))
    const { rerender } = render(<ResidentPicker value={null} onChange={() => {}} error="Selecciona al estudiante." />)

    expect(screen.getByRole('option', { name: 'Buscando…' })).toBeTruthy()
    expect(screen.getByText('Selecciona al estudiante.')).toBeTruthy()

    await act(async () => {
      resolveFetch({ data: [] })
    })
    rerender(<ResidentPicker value={null} onChange={() => {}} />)
    expect(screen.getByRole('option', { name: 'Selecciona un interno…' })).toBeTruthy()
  })
})
