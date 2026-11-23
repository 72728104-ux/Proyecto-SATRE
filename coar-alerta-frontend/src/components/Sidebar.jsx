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
  Users,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import CoarLogo from './CoarLogo'
import { ROLES } from '../data/roles'

const RESIDENCE_NAV_LABELS = new Set([
  'Permisos',
  'Residencia',
  'Pernocta',
  'Alergias',
  'Presencia nocturna',
  'Asistencia Nocturna',
  'Autorizar permisos',
])

const NAV = {
  [ROLES.ADMIN]: [
    { to: '/admin', label: 'Métricas', icon: LayoutDashboard },
    { to: '/admin/usuarios', label: 'Usuarios', icon: Users },
    { to: '/admin/aulas', label: 'Aulas', icon: GraduationCap },
    { to: '/admin/cursos', label: 'Cursos', icon: BookOpen },
    { to: '/admin/periodos', label: 'Periodos', icon: CalendarRange },
    { to: '/admin/auditoria', label: 'Auditoría', icon: ScrollText },
  ],
  [ROLES.TUTOR]: [
    { to: '/tutor', label: 'Riesgo del aula', icon: Shield },
    { to: '/tutor/asistencia', label: 'Asistencia', icon: ClipboardCheck },
    { to: '/tutor/notas', label: 'Calificaciones', icon: BookOpen },
    { to: '/tutor/reporte', label: 'Reporte de grupo', icon: FileBarChart },
    { to: '/tutor/ia', label: 'IA Docente', icon: Sparkles },
    { to: '/tutor/alertas', label: 'Alertas', icon: BellRing },
  ],
  [ROLES.RESIDENCIA]: [
    { to: '/residencia', label: 'Resumen', icon: LayoutDashboard, requiresResidence: true },
    { to: '/residencia/presencia', label: 'Presencia nocturna', icon: BedDouble, requiresResidence: true },
    { to: '/residencia/incidencias', label: 'Incidencias', icon: FileWarning, requiresResidence: true },
    { to: '/residencia/permisos', label: 'Permisos', icon: ClipboardCheck, requiresResidence: true },
    { to: '/residencia/alertas', label: 'Alertas', icon: BellRing, requiresResidence: true },
  ],
  [ROLES.ESTUDIANTE]: [
    { to: '/estudiante', label: 'Resumen', icon: LayoutDashboard },
    { to: '/estudiante/calificaciones', label: 'Calificaciones', icon: BookOpen },
    { to: '/estudiante/lecturas', label: 'Lecturas', icon: FileText },
    { to: '/estudiante/asistencia', label: 'Asistencia', icon: ClipboardCheck },
    { to: '/estudiante/permisos', label: 'Permisos', icon: Home, requiresResidence: true },
    { to: '/estudiante/tutor', label: 'IA Tutor', icon: Sparkles },
  ],
  [ROLES.APODERADO]: [
    { to: '/apoderado', label: 'Resumen', icon: LayoutDashboard },
    { to: '/apoderado/permisos', label: 'Autorizar permisos', icon: ClipboardCheck, requiresResidence: true },
    { to: '/apoderado/incidencias', label: 'Incidencias', icon: FileWarning },
  ],
}

export function visibleNavItems(role, collegeHasResidence = true) {
  const items = NAV[role] ?? []
  if (collegeHasResidence) return items
  return items.filter((item) => !item.requiresResidence && !RESIDENCE_NAV_LABELS.has(item.label))
}

export default function Sidebar({ role, collegeHasResidence = true, open, onClose }) {
  const items = visibleNavItems(role, collegeHasResidence)

  return (
    <>
      {open ? <button type="button" className="fixed inset-0 z-30 bg-navy-950/40 lg:hidden" onClick={onClose} /> : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-950 text-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <CoarLogo size={40} />
          <div>
            <p className="font-display text-lg leading-tight">COAR Junín</p>
            <p className="mt-1 text-xs text-white/60">Sistema de alerta temprana</p>
          </div>
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
