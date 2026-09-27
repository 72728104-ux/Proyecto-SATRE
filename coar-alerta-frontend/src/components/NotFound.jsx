import { MapPinOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function NotFound() {
  const { homePath } = useAuth()

  return (
    <div data-cy="not-found" className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <MapPinOff size={40} className="text-slate-400" />
      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Error 404</p>
      <h1 className="font-display mt-2 text-3xl text-navy-950">Página no encontrada</h1>
      <p className="mt-2 text-sm text-slate-500">La dirección no existe o fue movida.</p>
      <Link
        to={homePath}
        className="mt-6 w-full rounded-xl bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 sm:w-auto"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
