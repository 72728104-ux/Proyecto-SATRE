import { Navigate, Outlet } from 'react-router-dom'
import Forbidden from '../components/Forbidden'
import { useAuth } from '../context/AuthContext'
import { CHANGE_PASSWORD_PATH, ROLE_HOME } from '../data/roles'

export default function ProtectedRoute({ roles, allowPendingPasswordChange = false }) {
  const { isAuthenticated, role, homePath, mustChangePassword } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (mustChangePassword && !allowPendingPasswordChange) return <Navigate to={CHANGE_PASSWORD_PATH} replace />
  if (!ROLE_HOME[role]) return <Forbidden message="Tu cuenta no tiene un rol habilitado en SATRE." />
  if (roles && !roles.includes(role)) return <Navigate to={homePath} replace />

  return <Outlet />
}

/** Login, recuperar y restablecer contraseña: si ya hay sesión, va al home del rol. */
export function GuestRoute() {
  const { isAuthenticated, homePath } = useAuth()
  if (isAuthenticated) return <Navigate to={homePath} replace />
  return <Outlet />
}
