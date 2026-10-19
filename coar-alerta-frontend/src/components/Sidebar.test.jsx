import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { ROLES } from '../data/roles'
import Sidebar, { visibleNavItems } from './Sidebar'

afterEach(() => {
  cleanup()
})

function renderSidebar(props) {
  return render(
    <MemoryRouter>
      <Sidebar open onClose={() => {}} {...props} />
    </MemoryRouter>,
  )
}

describe('visibleNavItems', () => {
  it('mantiene Permisos y el módulo de residencia cuando el colegio tiene internado', () => {
    expect(visibleNavItems(ROLES.ESTUDIANTE, true).map((item) => item.label)).toContain('Permisos')
    expect(visibleNavItems(ROLES.RESIDENCIA, true).map((item) => item.to)).toContain('/residencia/permisos')
    expect(visibleNavItems(ROLES.RESIDENCIA, true).map((item) => item.label)).toContain('Presencia nocturna')
    expect(visibleNavItems(ROLES.APODERADO, true).map((item) => item.to)).toContain('/apoderado/permisos')
  })

  it('no incluye Matrículas en el menú del administrador', () => {
    const admin = visibleNavItems(ROLES.ADMIN, true).map((item) => item.label)
    expect(admin).not.toContain('Matrículas')
    expect(admin).toContain('Usuarios')
    expect(admin).toContain('Auditoría')
  })

  it('oculta Residencia, Pernocta, Alergias y Asistencia Nocturna si COLLEGE_HAS_RESIDENCE es false', () => {
    const student = visibleNavItems(ROLES.ESTUDIANTE, false).map((item) => item.label)
    expect(student).not.toContain('Permisos')
    expect(student).not.toContain('Residencia')
    expect(student).not.toContain('Pernocta')
    expect(student).not.toContain('Alergias')
    expect(student).not.toContain('Asistencia Nocturna')
    expect(student).toContain('Calificaciones')

    const monitor = visibleNavItems(ROLES.RESIDENCIA, false).map((item) => item.label)
    expect(monitor).not.toContain('Presencia nocturna')
    expect(monitor).not.toContain('Residencia')
    expect(monitor).not.toContain('Pernocta')
    expect(monitor).not.toContain('Alergias')
    expect(visibleNavItems(ROLES.RESIDENCIA, false)).toEqual([])

    const teacher = visibleNavItems(ROLES.TUTOR, false).map((item) => item.label)
    expect(teacher).not.toContain('Residencia')
    expect(teacher).not.toContain('Pernocta')
    expect(teacher).not.toContain('Alergias')
    expect(teacher).not.toContain('Asistencia Nocturna')
    expect(teacher).toContain('Calificaciones')

    expect(visibleNavItems(ROLES.APODERADO, false).map((item) => item.to)).not.toContain('/apoderado/permisos')
  })
})

describe('Sidebar', () => {
  it('no renderiza el acceso de Permisos del estudiante sin internado', () => {
    renderSidebar({ role: ROLES.ESTUDIANTE, collegeHasResidence: false })

    expect(screen.queryByText('Permisos')).toBeNull()
    expect(screen.getByText('Calificaciones')).toBeTruthy()
    expect(screen.getByText('IA Tutor')).toBeTruthy()
  })

  it('sigue mostrando Permisos cuando el colegio tiene residencia', () => {
    renderSidebar({ role: ROLES.ESTUDIANTE, collegeHasResidence: true })

    expect(screen.getByText('Permisos')).toBeTruthy()
  })
})
