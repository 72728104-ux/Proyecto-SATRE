import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CHANGE_PASSWORD_PATH, ROLES } from '../data/roles'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../layouts/DashboardLayout'
import Forbidden from '../components/Forbidden'
import NotFound from '../components/NotFound'
import Login from '../pages/Login'
import CambiarContrasena from '../pages/CambiarContrasena'
import DashboardAdmin from '../pages/admin/DashboardAdmin'
import Usuarios from '../pages/admin/Usuarios'
import Aulas from '../pages/admin/Aulas'
import Cursos from '../pages/admin/Cursos'
import Periodos from '../pages/admin/Periodos'
import Matriculas from '../pages/admin/Matriculas'
import Auditoria from '../pages/admin/Auditoria'
import DashboardTutor from '../pages/tutor/DashboardTutor'
import NotasIB from '../pages/tutor/NotasIB'
import AsistenciaAula from '../pages/tutor/AsistenciaAula'
import ReporteGrupo from '../pages/tutor/ReporteGrupo'
import IADocente from '../pages/tutor/IADocente'
import AlertasTutor from '../pages/tutor/AlertasTutor'
import DashboardMonitor from '../pages/residencia/DashboardMonitor'
import PresenciaNocturna from '../pages/residencia/PresenciaNocturna'
import Incidencias from '../pages/residencia/Incidencias'
import PermisosResidencia from '../pages/residencia/PermisosResidencia'
import AlertasResidencia from '../pages/residencia/AlertasResidencia'
import DashboardEstudiante from '../pages/estudiante/DashboardEstudiante'
import Calificaciones from '../pages/estudiante/Calificaciones'
import AsistenciaEstudiante from '../pages/estudiante/AsistenciaEstudiante'
import PermisosEstudiante from '../pages/estudiante/PermisosEstudiante'
import IATutor from '../pages/estudiante/IATutor'
import DashboardApoderado from '../pages/apoderado/DashboardApoderado'
import AutorizarPermisos from '../pages/apoderado/AutorizarPermisos'
import IncidenciasApoderado from '../pages/apoderado/IncidenciasApoderado'
import ProtectedRoute from './ProtectedRoute'

export default function AppRouter() {
  const { isAuthenticated, homePath } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute allowPendingPasswordChange />}>
          <Route path={CHANGE_PASSWORD_PATH} element={<CambiarContrasena />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route element={<ProtectedRoute roles={[ROLES.ADMIN]} />}>
              <Route path="/admin" element={<DashboardAdmin />} />
              <Route path="/admin/usuarios" element={<Usuarios />} />
              <Route path="/admin/aulas" element={<Aulas />} />
              <Route path="/admin/cursos" element={<Cursos />} />
              <Route path="/admin/periodos" element={<Periodos />} />
              <Route path="/admin/matriculas" element={<Matriculas />} />
              <Route path="/admin/auditoria" element={<Auditoria />} />
            </Route>

            <Route element={<ProtectedRoute roles={[ROLES.TUTOR]} />}>
              <Route path="/tutor" element={<DashboardTutor />} />
              <Route path="/tutor/notas" element={<NotasIB />} />
              <Route path="/tutor/asistencia" element={<AsistenciaAula />} />
              <Route path="/tutor/reporte" element={<ReporteGrupo />} />
              <Route path="/tutor/ia" element={<IADocente />} />
              <Route path="/tutor/alertas" element={<AlertasTutor />} />
            </Route>

            <Route element={<ProtectedRoute roles={[ROLES.RESIDENCIA]} />}>
              <Route path="/residencia" element={<DashboardMonitor />} />
              <Route path="/residencia/presencia" element={<PresenciaNocturna />} />
              <Route path="/residencia/incidencias" element={<Incidencias />} />
              <Route path="/residencia/permisos" element={<PermisosResidencia />} />
              <Route path="/residencia/alertas" element={<AlertasResidencia />} />
            </Route>

            <Route element={<ProtectedRoute roles={[ROLES.ESTUDIANTE]} />}>
              <Route path="/estudiante" element={<DashboardEstudiante />} />
              <Route path="/estudiante/calificaciones" element={<Calificaciones />} />
              <Route path="/estudiante/asistencia" element={<AsistenciaEstudiante />} />
              <Route path="/estudiante/permisos" element={<PermisosEstudiante />} />
              <Route path="/estudiante/tutor" element={<IATutor />} />
            </Route>

            <Route element={<ProtectedRoute roles={[ROLES.APODERADO]} />}>
              <Route path="/apoderado" element={<DashboardApoderado />} />
              <Route path="/apoderado/permisos" element={<AutorizarPermisos />} />
              <Route path="/apoderado/incidencias" element={<IncidenciasApoderado />} />
            </Route>

            <Route path="/403" element={<Forbidden />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to={isAuthenticated ? homePath : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
