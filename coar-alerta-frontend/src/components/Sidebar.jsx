import {
  BedDouble,
  BellRing,
  BookOpen,
  CalendarRange,
  ClipboardCheck,
  FileBarChart,
  FileText,
  FileWarning,
  GraduationCap,
  Home,
  LayoutDashboard,
  ScrollText,
  Shield,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { ROLES } from '../data/roles'

const NAV = {
  [ROLES.ADMIN]: [
    { to: '/admin', label: 'Métricas', icon: LayoutDashboard },
    { to: '/admin/usuarios', label: 'Usuarios', icon: Users },
    { to: '/admin/aulas', label: 'Aulas', icon: GraduationCap },
    { to: '/admin/cursos', label: 'Cursos', icon: BookOpen },
    { to: '/admin/periodos', label: 'Periodos', icon: CalendarRange },
    { to: '/admin/matriculas', label: 'Matrículas', icon: UserPlus },
    { to: '/admin/auditoria', label: 'Auditoría', icon: ScrollText },
  ],
  [ROLES.TUTOR]: [
    { to: '/tutor', label: 'Riesgo del aula', icon: Shield },
    { to: '/tutor/asistencia', label: 'Asistencia', icon: ClipboardCheck },
    { to: '/tutor/notas', label: 'Notas IB', icon: BookOpen },
    { to: '/tutor/reporte', label: 'Reporte de grupo', icon: FileBarChart },
    { to: '/tutor/ia', label: 'IA Docente', icon: Sparkles },
    { to: '/tutor/alertas', label: 'Alertas', icon: BellRing },
  ],
  [ROLES.RESIDENCIA]: [
    { to: '/residencia', label: 'Resumen', icon: LayoutDashboard },
    { to: '/residencia/presencia', label: 'Presencia nocturna', icon: BedDouble },
    { to: '/residencia/incidencias', label: 'Incidencias', icon: FileWarning },
    { to: '/residencia/permisos', label: 'Permisos', icon: ClipboardCheck },
    { to: '/residencia/alertas', label: 'Alertas', icon: BellRing },
  ],
  [ROLES.ESTUDIANTE]: [
    { to: '/estudiante', label: 'Resumen', icon: LayoutDashboard },
    { to: '/estudiante/calificaciones', label: 'Calificaciones', icon: BookOpen },
    { to: '/estudiante/lecturas', label: 'Lecturas', icon: FileText },
    { to: '/estudiante/asistencia', label: 'Asistencia', icon: ClipboardCheck },
    { to: '/estudiante/permisos', label: 'Permisos', icon: Home },
    { to: '/estudiante/tutor', label: 'IA Tutor', icon: Sparkles },
  ],
  [ROLES.APODERADO]: [
    { to: '/apoderado', label: 'Resumen', icon: LayoutDashboard },
    { to: '/apoderado/permisos', label: 'Autorizar permisos', icon: ClipboardCheck },
    { to: '/apoderado/incidencias', label: 'Incidencias', icon: FileWarning },
  ],
}

export default function Sidebar({ role, open, onClose }) {
  const items = NAV[role] ?? []

  return (
    <>
      {open ? <button type="button" className="fixed inset-0 z-30 bg-navy-950/40 lg:hidden" onClick={onClose} /> : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-950 text-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <p className="font-display text-lg leading-tight">COAR Junín</p>
          <p className="mt-1 text-xs text-white/60">Sistema de alerta temprana</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                  isActive ? 'bg-teal-500/20 text-teal-200' : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="px-5 py-4 text-[11px] text-white/40">SATRE · API Laravel</p>
      </aside>
    </>
  )
}
