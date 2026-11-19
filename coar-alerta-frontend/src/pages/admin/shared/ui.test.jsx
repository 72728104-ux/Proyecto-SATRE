import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Field from '../../../components/Field'
import { fetchClassrooms, fetchCourses, fetchPeriods, fetchUsers } from '../../../api/admin'
import {
  CourseSelect,
  ClassroomSelect,
  FilterBar,
  FormModal,
  LoadError,
  PageHeader,
  PeriodSelect,
  UserPicker,
  actionButton,
  dangerActionButton,
  linkButton,
  primaryButton,
  rowActions,
  secondaryButton,
} from './ui'

vi.mock('../../../api/admin', () => ({
  fetchPeriods: vi.fn(),
  fetchClassrooms: vi.fn(),
  fetchCourses: vi.fn(),
  fetchUsers: vi.fn(),
}))

beforeEach(() => {  fetchPeriods.mockResolvedValue({
    data: [
      { id: 2, name: '2026', is_current: true },
      { id: 3, name: '2027', is_current: false },
    ],
  })
  fetchClassrooms.mockResolvedValue({
    data: [{ id: 4, name: '5to A', grade_level: '5to' }],
  })
  fetchCourses.mockResolvedValue({
    data: [{ id: 5, code: 'MAT-5A', name: 'Matemáticas' }],
  })
  fetchUsers.mockResolvedValue({
    data: [
      { id: 10, profile_id: 3, name: 'Ana Docente', email: 'ana@coar.edu.pe' },
      { id: 11, profile_id: null, name: 'Sin perfil', email: 'sin@coar.edu.pe' },
    ],
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PageHeader', () => {
  it('muestra título, descripción y la acción principal', () => {
    const onAction = vi.fn()
    render(
      <PageHeader
        title="Aulas"
        description="Aulas por periodo."
        actionLabel="Nueva aula"
        onAction={onAction}
        actionCy="nueva-aula"
      />,
    )

    expect(screen.getByRole('heading', { name: 'Aulas' })).toBeTruthy()
    expect(screen.getByText('Aulas por periodo.')).toBeTruthy()

    const button = screen.getByRole('button', { name: /Nueva aula/ })
    expect(button.getAttribute('data-cy')).toBe('nueva-aula')
    fireEvent.click(button)
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('omite la acción y la descripción cuando no se entregan', () => {
    render(<PageHeader title="Periodos" />)
    expect(screen.getByRole('heading', { name: 'Periodos' })).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText(/Aulas por periodo/)).toBeNull()
  })
})

describe('FilterBar y LoadError', () => {
  it('renderiza los filtros hijos', () => {
    render(
      <FilterBar>
        <Field label="Buscar" name="search" />
      </FilterBar>,
    )
    expect(screen.getByLabelText('Buscar')).toBeTruthy()
  })

  it('invita a reintentar cuando falla la carga', () => {
    const onRetry = vi.fn()
    render(<LoadError onRetry={onRetry} />)

    expect(screen.getByText('No se pudo cargar la información.')).toBeTruthy()
    expect(screen.getByText('Verifica tu conexión e inténtalo nuevamente.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe('FormModal', () => {
  it('envía el formulario y permite cancelar', () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    render(
      <FormModal title="Nueva aula" onSubmit={onSubmit} onClose={onClose}>
        <Field label="Nombre" name="name" />
      </FormModal>,
    )

    expect(screen.getByRole('dialog', { name: 'Nueva aula' })).toBeTruthy()
    expect(screen.getByLabelText(/^Nombre/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('bloquea botones y cierra con Escape cuando no está guardando', () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    const { rerender } = render(
      <FormModal title="Nueva aula" onSubmit={onSubmit} onClose={onClose}>
        <Field label="Nombre" name="name" />
      </FormModal>,
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(
      <FormModal title="Nueva aula" onSubmit={onSubmit} onClose={onClose} loading>
        <Field label="Nombre" name="name" />
      </FormModal>,
    )

    expect(screen.getByRole('button', { name: 'Guardando…' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancelar' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Guardando…' }))
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('usa la etiqueta de envío personalizada', () => {
    render(
      <FormModal title="Editar" onSubmit={vi.fn()} onClose={vi.fn()} submitLabel="Actualizar">
        <Field label="Nombre" name="name" />
      </FormModal>,
    )
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeTruthy()
  })
})

describe('PeriodSelect', () => {
  it('carga periodos, marca el vigente y devuelve el id numérico', async () => {
    const onChange = vi.fn()
    render(<PeriodSelect label="Periodo" name="academic_period_id" value={null} onChange={onChange} />)

    await waitFor(() => expect(screen.getByRole('option', { name: '2026 (vigente)' })).toBeTruthy())
    expect(screen.getByRole('option', { name: '2027' })).toBeTruthy()
    expect(fetchPeriods).toHaveBeenCalledWith({}, expect.objectContaining({ signal: expect.anything() }))

    fireEvent.change(screen.getByLabelText('Periodo'), { target: { value: '3' } })
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('mantiene visible el periodo seleccionado aunque no venga en la página', async () => {
    render(
      <PeriodSelect
        label="Periodo"
        name="academic_period_id"
        value={1}
        selected={{ id: 1, name: '2025' }}
        onChange={vi.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByRole('option', { name: '2025' })).toBeTruthy())
    expect(screen.getByLabelText('Periodo').value).toBe('1')
  })

  it('muestra el placeholder mientras carga', () => {
    fetchPeriods.mockReturnValue(new Promise(() => {}))
    render(<PeriodSelect label="Periodo" name="academic_period_id" value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('option', { name: 'Cargando…' })).toBeTruthy()
  })
})

describe('ClassroomSelect', () => {
  it('consulta aulas del periodo y las etiqueta con el grado', async () => {
    const onChange = vi.fn()
    render(
      <ClassroomSelect label="Aula" name="classroom_id" periodId={2} value={null} onChange={onChange} />,
    )

    await waitFor(() => expect(screen.getByRole('option', { name: '5to A · 5to' })).toBeTruthy())
    expect(fetchClassrooms).toHaveBeenCalledWith(
      { academic_period_id: 2 },
      expect.objectContaining({ signal: expect.anything() }),
    )

    fireEvent.change(screen.getByLabelText('Aula'), { target: { value: '4' } })
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('consulta todas las aulas cuando no hay periodo elegido', async () => {
    render(<ClassroomSelect label="Aula" name="classroom_id" periodId={null} value={null} onChange={vi.fn()} />)
    const select = screen.getByLabelText('Aula')
    expect(select.disabled).toBe(false)
    await waitFor(() =>
      expect(fetchClassrooms).toHaveBeenCalledWith(
        { academic_period_id: null },
        expect.objectContaining({ signal: expect.anything() }),
      ),
    )
  })
})

describe('CourseSelect', () => {
  it('pide el periodo antes de habilitar el curso', () => {
    render(<CourseSelect label="Curso" name="course_id" periodId={null} value={null} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Curso').disabled).toBe(true)
    expect(screen.getByRole('option', { name: 'Primero elige un periodo' })).toBeTruthy()
    expect(fetchCourses).not.toHaveBeenCalled()
  })

  it('carga cursos del periodo y aula elegidos', async () => {
    const onChange = vi.fn()
    render(
      <CourseSelect
        label="Curso"
        name="course_id"
        periodId={2}
        classroomId={4}
        value={null}
        onChange={onChange}
      />,
    )

    await waitFor(() => expect(screen.getByRole('option', { name: 'MAT-5A · Matemáticas' })).toBeTruthy())
    expect(fetchCourses).toHaveBeenCalledWith(
      { academic_period_id: 2, classroom_id: 4 },
      expect.objectContaining({ signal: expect.anything() }),
    )

    fireEvent.change(screen.getByLabelText('Curso'), { target: { value: '5' } })
    expect(onChange).toHaveBeenCalledWith(5)
  })
})

describe('UserPicker', () => {
  it('busca usuarios activos, descarta perfiles nulos y devuelve profile_id', async () => {
    const onChange = vi.fn()
    render(
      <UserPicker
        label="Tutor"
        name="tutor_id"
        role="teacher"
        value={null}
        onChange={onChange}
        placeholder="Sin tutor"
      />,
    )

    await waitFor(() => expect(screen.getByRole('option', { name: 'Ana Docente · ana@coar.edu.pe' })).toBeTruthy())
    expect(screen.queryByRole('option', { name: /Sin perfil/ })).toBeNull()
    expect(fetchUsers).toHaveBeenCalledWith(
      { role: 'teacher', search: '', is_active: 1 },
      expect.objectContaining({ signal: expect.anything() }),
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'Tutor' }), { target: { value: '3' } })
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('incluye inactivos y busca por texto con debounce', async () => {
    const onChange = vi.fn()
    render(
      <UserPicker
        label="Usuario"
        name="user_id"
        valueKey="id"
        activeOnly={false}
        value={null}
        onChange={onChange}
        placeholder="Todos"
      />,
    )

    await waitFor(() => expect(screen.getByRole('option', { name: 'Ana Docente · ana@coar.edu.pe' })).toBeTruthy())
    expect(fetchUsers).toHaveBeenCalledWith(
      { role: undefined, search: '', is_active: undefined },
      expect.objectContaining({ signal: expect.anything() }),
    )
    expect(screen.getByRole('option', { name: 'Sin perfil · sin@coar.edu.pe' })).toBeTruthy()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Usuario' }), { target: { value: 'ana' } })
    await waitFor(() =>
      expect(fetchUsers).toHaveBeenLastCalledWith(
        { role: undefined, search: 'ana', is_active: undefined },
        expect.objectContaining({ signal: expect.anything() }),
      ),
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'Usuario' }), { target: { value: '10' } })
    expect(onChange).toHaveBeenCalledWith(10)
  })

  it('muestra el usuario seleccionado fuera de la página y su placeholder al crear', async () => {
    render(
      <UserPicker
        label="Tutor"
        name="tutor_id"
        value={99}
        selected={{ id: 99, name: 'Docente Antiguo' }}
        onChange={vi.fn()}
        placeholder="Sin tutor asignado"
      />,
    )

    await waitFor(() => expect(screen.getByRole('option', { name: 'Docente Antiguo' })).toBeTruthy())
    expect(screen.getByRole('combobox', { name: 'Tutor' }).value).toBe('99')
    expect(screen.getByRole('option', { name: 'Sin tutor asignado' })).toBeTruthy()
  })

  it('cae al id cuando el usuario seleccionado no tiene nombre', async () => {
    render(
      <UserPicker label="Tutor" name="tutor_id" value={77} selected={null} onChange={vi.fn()} />,
    )
    await waitFor(() => expect(screen.getByRole('option', { name: '#77' })).toBeTruthy())
  })

  it('propaga el error de validación del select', () => {
    render(
      <UserPicker
        label="Tutor"
        name="tutor_id"
        value={null}
        onChange={vi.fn()}
        error="Selecciona un tutor"
        required
      />,
    )
    expect(screen.getByText('Selecciona un tutor')).toBeTruthy()
  })
})

describe('estilos compartidos', () => {
  it('exporta clases reutilizables', () => {
    for (const className of [primaryButton, secondaryButton, linkButton, rowActions, actionButton, dangerActionButton]) {
      expect(typeof className).toBe('string')
      expect(className.length).toBeGreaterThan(0)
    }
    expect(primaryButton).toContain('bg-navy-900')
    expect(dangerActionButton).toContain('text-rose-700')
  })
})
