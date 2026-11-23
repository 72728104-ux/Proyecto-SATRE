import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { CourseAverageList, DashboardSkeleton, Panel } from './DashboardBlocks'

afterEach(cleanup)

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('DashboardSkeleton', () => {
  it('muestra cinco bloques de carga decorativos', () => {
    const { container } = wrap(<DashboardSkeleton />)

    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(5)
  })
})

describe('Panel', () => {
  it('muestra el título y los hijos sin enlace si no hay destino', () => {
    wrap(
      <Panel title="Riesgo del aula">
        <p>Contenido del panel</p>
      </Panel>,
    )

    expect(screen.getByRole('heading', { name: 'Riesgo del aula' })).toBeTruthy()
    expect(screen.getByText('Contenido del panel')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Ver detalle' })).toBeNull()
  })

  it('agrega el enlace de detalle cuando recibe to', () => {
    wrap(
      <Panel title="Cursos" to="/estudiante/calificaciones">
        <p>Lista</p>
      </Panel>,
    )

    expect(screen.getByRole('link', { name: 'Ver detalle' }).getAttribute('href')).toBe('/estudiante/calificaciones')
  })
})

describe('CourseAverageList', () => {
  it('muestra un estado vacío sin cursos', () => {
    wrap(<CourseAverageList courses={undefined} />)
    expect(screen.getByText('Aún no hay notas en este periodo.')).toBeTruthy()

    cleanup()
    wrap(<CourseAverageList courses={[]} />)
    expect(screen.getByText('Aún no hay notas en este periodo.')).toBeTruthy()
  })

  it('lista los promedios por curso con su literal', () => {
    wrap(
      <CourseAverageList
        courses={[
          { course_id: 1, course_name: 'Matemáticas AA', count: 2, average: 16.5, literal: 'A' },
          { course_id: 2, course_name: 'Biología', count: 1, average: 19, literal: 'AD' },
        ]}
      />,
    )

    expect(screen.getByText('Matemáticas AA')).toBeTruthy()
    expect(screen.getByText('2 evaluación(es)')).toBeTruthy()
    expect(screen.getByText('16.5 (A)')).toBeTruthy()
    expect(screen.getByText('Biología')).toBeTruthy()
    expect(screen.getByText('19 (AD)')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
