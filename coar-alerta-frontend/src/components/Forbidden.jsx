import { ShieldX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLE_HOME } from '../data/roles'

export default function Forbidden({ message = 'No tienes permiso para ver esta sección.' }) {
  const { role, logout } = useAuth()
  const home = ROLE_HOME[role]

  return (
    <div data-cy="forbidden" className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <ShieldX size={40} className="text-rose-500" />
      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-rose-600">Error 403</p>
      <h1 className="font-display mt-2 text-3xl text-navy-950">Acceso denegado</h1>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        {home ? (
          <Link
            to={home}
            className="rounded-xl bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
          >
            Ir a mi inicio
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => logout()}
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
