import { Bell, LogOut, Menu } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import RoleSwitcher from './RoleSwitcher'

export default function Navbar({ onMenu }) {
  const { user, roleLabel, logout } = useAuth()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-white/10 bg-navy-900 px-4 text-white lg:px-6">
      <div className="flex items-center gap-3">
        <button type="button" className="rounded-lg p-2 hover:bg-white/10 lg:hidden" onClick={onMenu}>
          <Menu size={20} />
        </button>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-teal-300">SATRE · COAR Junín</p>
          <p className="text-sm font-medium">{roleLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {import.meta.env.DEV ? <RoleSwitcher /> : null}
        <button type="button" className="rounded-lg p-2 hover:bg-white/10" aria-label="Notificaciones">
          <Bell size={18} />
        </button>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">{user?.name}</p>
          <p className="text-xs text-white/60">{user?.cargo}</p>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          data-cy="logout"
          className="rounded-lg p-2 hover:bg-white/10"
          aria-label="Cerrar sesión"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
