import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../context/AuthContext'
import AsistenciaEstudiante from './AsistenciaEstudiante'

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('./shared', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useMySummary: () => ({ summary: { courses: [], attendance: { rate: null } } }),
  }
})

vi.mock('../admin/shared/hooks', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    usePagedList: () => ({
      filters: { status: '', course_id: '', check_type: '' },
      setFilter: () => {},
      data: { data: [] },
      rows: [],
      loading: false,
      error: null,
      meta: null,
      setPage: () => {},
      reload: () => {},
    }),
  }
})

describe('AsistenciaEstudiante', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    })
  })

  beforeEach(() => {
    useAuth.mockReturnValue({ collegeHasResidence: true })
  })

  afterEach(() => {
    cleanup()
  })

  it('muestra la pestaña Residencia cuando el colegio tiene internado', () => {
    render(<AsistenciaEstudiante />)
    expect(screen.getByRole('tab', { name: 'Residencia' })).toBeTruthy()
  })

  it('oculta Residencia si COLLEGE_HAS_RESIDENCE es false', () => {
    useAuth.mockReturnValue({ collegeHasResidence: false })
    render(<AsistenciaEstudiante />)
    expect(screen.queryByRole('tab', { name: 'Residencia' })).toBeNull()
    expect(screen.queryByText('Residencia')).toBeNull()
    expect(screen.getByText('Historial de asistencia en aula.')).toBeTruthy()
  })
})
