import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppRouter from './AppRouter'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}))
vi.mock('../layouts/DashboardLayout', async () => {
  const { Outlet } = await import('react-router-dom')
  return {
    default: () => (
      <div>
        layout:
        <Outlet />
      </div>
    ),
  }
})

vi.mock('../pages/Landing', () => ({ default: () => <div>landing</div> }))
vi.mock('../pages/Login', () => ({ default: () => <div>login</div> }))
vi.mock('../pages/CambiarContrasena', () => ({ default: () => <div>cambiar-contrasena</div> }))
vi.mock('../pages/RecuperarContrasena', () => ({ default: () => <div>recuperar-contrasena</div> }))
vi.mock('../pages/RestablecerContrasena', () => ({ default: () => <div>restablecer-contrasena</div> }))

vi.mock('../pages/admin/DashboardAdmin', () => ({ default: () => <div>admin-home</div> }))
vi.mock('../pages/admin/Usuarios', () => ({ default: () => <div>admin-usuarios</div> }))
vi.mock('../pages/admin/Aulas', () => ({ default: () => <div>admin-aulas</div> }))
vi.mock('../pages/admin/Cursos', () => ({ default: () => <div>admin-cursos</div> }))
vi.mock('../pages/admin/Periodos', () => ({ default: () => <div>admin-periodos</div> }))
vi.mock('../pages/admin/Auditoria', () => ({ default: () => <div>admin-auditoria</div> }))

vi.mock('../pages/tutor/DashboardTutor', () => ({ default: () => <div>tutor-home</div> }))
vi.mock('../pages/tutor/NotasIB', () => ({ default: () => <div>tutor-notas</div> }))
vi.mock('../pages/tutor/AsistenciaAula', () => ({ default: () => <div>tutor-asistencia</div> }))
vi.mock('../pages/tutor/ReporteGrupo', () => ({ default: () => <div>tutor-reporte</div> }))
vi.mock('../pages/tutor/IADocente', () => ({ default: () => <div>ia-docente</div> }))
vi.mock('../pages/tutor/AlertasTutor', () => ({ default: () => <div>tutor-alertas</div> }))

vi.mock('../pages/residencia/DashboardMonitor', () => ({ default: () => <div>residencia-home</div> }))
vi.mock('../pages/residencia/PresenciaNocturna', () => ({ default: () => <div>residencia-presencia</div> }))
vi.mock('../pages/residencia/Incidencias', () => ({ default: () => <div>residencia-incidencias</div> }))
vi.mock('../pages/residencia/PermisosResidencia', () => ({ default: () => <div>residencia-permisos</div> }))
vi.mock('../pages/residencia/AlertasResidencia', () => ({ default: () => <div>residencia-alertas</div> }))

vi.mock('../pages/estudiante/DashboardEstudiante', () => ({ default: () => <div>estudiante-home</div> }))
vi.mock('../pages/estudiante/Calificaciones', () => ({ default: () => <div>estudiante-calificaciones</div> }))
vi.mock('../pages/estudiante/AsistenciaEstudiante', () => ({ default: () => <div>estudiante-asistencia</div> }))
vi.mock('../pages/estudiante/PermisosEstudiante', () => ({ default: () => <div>estudiante-permisos</div> }))
vi.mock('../pages/estudiante/IATutor', () => ({ default: () => <div>ia-tutor</div> }))
vi.mock('../pages/estudiante/LecturasEstudiante', () => ({ default: () => <div>estudiante-lecturas</div> }))

vi.mock('../pages/apoderado/DashboardApoderado', () => ({ default: () => <div>apoderado-home</div> }))
vi.mock('../pages/apoderado/AutorizarPermisos', () => ({ default: () => <div>apoderado-permisos</div> }))
vi.mock('../pages/apoderado/IncidenciasApoderado', () => ({ default: () => <div>apoderado-incidencias</div> }))

const logout = vi.fn()

function auth(overrides = {}) {
  return {
    isAuthenticated: true,
    role: 'admin',
    homePath: '/admin',
    mustChangePassword: false,
    collegeHasResidence: true,
    logout,
    ...overrides,
  }
}

function renderAt(path) {
  window.history.pushState({}, '', path)
  return render(<AppRouter />)
}

let authState

beforeEach(() => {
  logout.mockReset()
  authState = auth()
  window.history.pushState({}, '', '/')
})

afterEach(cleanup)

describe('AppRouter', () => {
  it('muestra las rutas públicas cuando no hay sesión', () => {
    authState = auth({ isAuthenticated: false, role: null, homePath: '/login' })

    renderAt('/')
    expect(screen.getByText('landing')).toBeTruthy()

    cleanup()
    renderAt('/login')
    expect(screen.getByText('login')).toBeTruthy()

    cleanup()
    renderAt('/recuperar-contrasena')
    expect(screen.getByText('recuperar-contrasena')).toBeTruthy()

    cleanup()
    renderAt('/reset-password?token=x&email=y')
    expect(screen.getByText('restablecer-contrasena')).toBeTruthy()
  })

  it('redirige al login si no hay sesión en una ruta protegida', () => {
    authState = auth({ isAuthenticated: false, role: null, homePath: '/login' })

    renderAt('/admin')

    expect(screen.getByText('login')).toBeTruthy()
    expect(screen.queryByText('admin-home')).toBeNull()
  })

  it('renderiza el home del rol autenticado dentro del layout', () => {
    renderAt('/admin')

    expect(screen.getByText('layout:')).toBeTruthy()
    expect(screen.getByText('admin-home')).toBeTruthy()
  })

  it('lleva al cambio de contraseña cuando es obligatorio', () => {
    authState = auth({ mustChangePassword: true, homePath: '/cambiar-contrasena' })

    renderAt('/admin')
    expect(screen.getByText('cambiar-contrasena')).toBeTruthy()

    cleanup()
    renderAt('/cambiar-contrasena')
    expect(screen.getByText('cambiar-contrasena')).toBeTruthy()
  })

  it('redirige al home del rol cuando la ruta no pertenece a su rol', () => {
    authState = auth({ role: 'estudiante', homePath: '/estudiante' })

    renderAt('/admin')

    expect(screen.getByText('estudiante-home')).toBeTruthy()
    expect(screen.queryByText('admin-home')).toBeNull()
  })

  it('redirige al login a un usuario autenticado que visita una ruta pública', () => {
    renderAt('/login')

    expect(screen.getByText('admin-home')).toBeTruthy()
    expect(screen.queryByText('login')).toBeNull()
  })

  it('envía al estudiante que entra a /tutor/ia a su IA Tutor', () => {
    authState = auth({ role: 'estudiante', homePath: '/estudiante' })

    renderAt('/tutor/ia')

    expect(screen.getByText('ia-tutor')).toBeTruthy()
    expect(screen.queryByText('ia-docente')).toBeNull()
  })

  it('permite al tutor usar /tutor/ia', () => {
    authState = auth({ role: 'tutor', homePath: '/tutor' })

    renderAt('/tutor/ia')

    expect(screen.getByText('ia-docente')).toBeTruthy()
  })

  it('bloquea residencia si el colegio no tiene internado', () => {
    authState = auth({ role: 'residencia', homePath: '/residencia', collegeHasResidence: false })

    renderAt('/residencia')

    expect(screen.getByText('Acceso denegado')).toBeTruthy()
    expect(screen.getByText('El módulo de residencia no está habilitado para este colegio.')).toBeTruthy()
    expect(screen.queryByText('residencia-home')).toBeNull()
  })

  it('permite permisos de estudiante solo con internado', () => {
    authState = auth({ role: 'estudiante', homePath: '/estudiante' })
    renderAt('/estudiante/permisos')
    expect(screen.getByText('estudiante-permisos')).toBeTruthy()

    cleanup()
    authState = auth({ role: 'estudiante', homePath: '/estudiante', collegeHasResidence: false })
    renderAt('/estudiante/permisos')
    expect(screen.queryByText('estudiante-permisos')).toBeNull()
    expect(screen.getByText('Acceso denegado')).toBeTruthy()
  })

  it('permite las rutas de apoderado y su módulo de permisos', () => {
    authState = auth({ role: 'apoderado', homePath: '/apoderado' })

    renderAt('/apoderado')
    expect(screen.getByText('apoderado-home')).toBeTruthy()

    cleanup()
    renderAt('/apoderado/permisos')
    expect(screen.getByText('apoderado-permisos')).toBeTruthy()
  })

  it('muestra 403 y 404 dentro del layout protegido', () => {
    renderAt('/403')
    expect(screen.getByText('Acceso denegado')).toBeTruthy()
    expect(screen.getByText('layout:')).toBeTruthy()

    cleanup()
    renderAt('/ruta-que-no-existe')
    expect(screen.getByText('Página no encontrada')).toBeTruthy()
  })
})
