import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ProtectedRoute, { GuestRoute } from '../routes/ProtectedRoute'

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const logout = vi.fn()

function renderAt(ui, path = '/app') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Página de login</div>} />
        <Route path="/cambiar-contrasena" element={<div>Cambio de contraseña</div>} />
        <Route path="/forbidden" element={<div>Ruta forbidden</div>} />
        <Route path="/" element={<div>Inicio raíz</div>} />
        <Route path="/admin" element={<div>Home admin</div>} />
        <Route path="/tutor" element={<div>Home tutor</div>} />
        <Route path="/403" element={<div>Home 403</div>} />
        {ui}
      </Routes>
    </MemoryRouter>,
  )
}

function authState(overrides = {}) {
  return {
    isAuthenticated: true,
    role: 'tutor',
    homePath: '/tutor',
    mustChangePassword: false,
    collegeHasResidence: true,
    logout,
    ...overrides,
  }
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    logout.mockReset()
    useAuth.mockReturnValue(authState())
  })

  afterEach(() => {
    cleanup()
  })

  it('redirige a /login cuando no hay sesión', () => {
    useAuth.mockReturnValue(authState({ isAuthenticated: false, role: null, homePath: '/login' }))

    renderAt(
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<div>Contenido protegido</div>} />
      </Route>,
    )

    expect(screen.getByText('Página de login')).toBeTruthy()
    expect(screen.queryByText('Contenido protegido')).toBeNull()
  })

  it('redirige a /cambiar-contrasena si debe cambiar la contraseña', () => {
    useAuth.mockReturnValue(authState({ mustChangePassword: true, homePath: '/cambiar-contrasena' }))

    renderAt(
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<div>Contenido protegido</div>} />
      </Route>,
    )

    expect(screen.getByText('Cambio de contraseña')).toBeTruthy()
  })

  it('permite el Outlet si el cambio de contraseña está autorizado en la ruta', () => {
    useAuth.mockReturnValue(authState({ mustChangePassword: true, homePath: '/cambiar-contrasena' }))

    renderAt(
      <Route element={<ProtectedRoute allowPendingPasswordChange />}>
        <Route path="/app" element={<div>Formulario de cambio</div>} />
      </Route>,
    )

    expect(screen.getByText('Formulario de cambio')).toBeTruthy()
  })

  it('muestra Forbidden cuando el rol no tiene home habilitado', () => {
    useAuth.mockReturnValue(authState({ role: 'desconocido', homePath: '/403' }))

    renderAt(
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<div>Contenido protegido</div>} />
      </Route>,
    )

    expect(screen.getByText('Acceso denegado')).toBeTruthy()
    expect(screen.getByText('Tu cuenta no tiene un rol habilitado en SATRE.')).toBeTruthy()
    expect(screen.queryByText('Contenido protegido')).toBeNull()
  })

  it('redirige al home del rol cuando no está en la lista permitida', () => {
    useAuth.mockReturnValue(authState({ role: 'tutor', homePath: '/tutor' }))

    renderAt(
      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route path="/app" element={<div>Solo admin</div>} />
      </Route>,
    )

    expect(screen.getByText('Home tutor')).toBeTruthy()
    expect(screen.queryByText('Solo admin')).toBeNull()
  })

  it('redirige a / cuando el homePath del rol no permitido es la raíz', () => {
    useAuth.mockReturnValue(authState({ role: 'admin', homePath: '/' }))

    renderAt(
      <Route element={<ProtectedRoute roles={['tutor']} />}>
        <Route path="/app" element={<div>Solo tutor</div>} />
      </Route>,
    )

    expect(screen.getByText('Inicio raíz')).toBeTruthy()
  })

  it('renderiza el Outlet cuando cumple autenticación, contraseña y rol', () => {
    useAuth.mockReturnValue(authState({ role: 'admin', homePath: '/admin' }))

    renderAt(
      <Route element={<ProtectedRoute roles={['admin', 'tutor']} />}>
        <Route path="/app" element={<div>Panel autorizado</div>} />
      </Route>,
    )

    expect(screen.getByText('Panel autorizado')).toBeTruthy()
  })

  it('bloquea rutas de internado si COLLEGE_HAS_RESIDENCE es false', () => {
    useAuth.mockReturnValue(authState({ role: 'residencia', homePath: '/residencia', collegeHasResidence: false }))

    renderAt(
      <Route element={<ProtectedRoute roles={['residencia']} requiresResidence />}>
        <Route path="/app" element={<div>Presencia nocturna</div>} />
      </Route>,
    )

    expect(screen.getByText('Acceso denegado')).toBeTruthy()
    expect(screen.getByText('El módulo de residencia no está habilitado para este colegio.')).toBeTruthy()
    expect(screen.queryByText('Presencia nocturna')).toBeNull()
  })
})

describe('GuestRoute', () => {
  afterEach(() => {
    cleanup()
  })

  function renderGuest(path = '/login') {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin" element={<div>Home admin</div>} />
          <Route element={<GuestRoute />}>
            <Route path="/" element={<div>Portal público</div>} />
            <Route path="/login" element={<div>Formulario invitado</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
  }

  it('deja ver el Outlet si no hay sesión', () => {
    useAuth.mockReturnValue(authState({ isAuthenticated: false, homePath: '/login' }))
    renderGuest()
    expect(screen.getByText('Formulario invitado')).toBeTruthy()
  })

  it('deja ver el portal público en / si no hay sesión', () => {
    useAuth.mockReturnValue(authState({ isAuthenticated: false, homePath: '/login' }))
    renderGuest('/')
    expect(screen.getByText('Portal público')).toBeTruthy()
  })

  it('redirige al home del rol si ya hay sesión', () => {
    useAuth.mockReturnValue(authState({ role: 'admin', homePath: '/admin' }))
    renderGuest()
    expect(screen.getByText('Home admin')).toBeTruthy()
    expect(screen.queryByText('Formulario invitado')).toBeNull()
  })
})
