import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { CHANGE_PASSWORD_PATH, ROLE_HOME } from '../data/roles'
import { useAuth } from '../context/AuthContext'

const LOGOUT_MESSAGES = {
  inactivity: 'Tu sesión se cerró tras 30 minutos de inactividad.',
  expired: 'Tu sesión expiró. Vuelve a iniciar sesión.',
}

export default function Login() {
  const { isAuthenticated, homePath, login, logoutReason } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to={homePath} replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    navigate(result.user.mustChangePassword ? CHANGE_PASSWORD_PATH : (ROLE_HOME[result.user.role] ?? '/403'), {
      replace: true,
    })
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-navy-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.18),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(251,191,36,0.12),transparent_35%)]" />
        <div className="relative">
          <p className="text-sm uppercase tracking-[0.22em] text-teal-300">COAR Junín</p>
          <h1 className="font-display mt-6 max-w-md text-4xl leading-tight">
            Sistema web de alerta temprana para retención estudiantil
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            El inicio de sesión y la asistencia de aula (PO01) se validan en Laravel. Los demás módulos aún usan datos de demostración.
          </p>
        </div>
        <p className="relative text-sm text-white/50">SATRE · API Laravel · recall institucional ≥ 0.85</p>
      </section>

      <section className="flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <GraduationCap className="text-navy-900" />
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-teal-700">SATRE</p>
              <p className="font-semibold text-navy-950">COAR Junín</p>
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            data-cy="login-form"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <h2 className="font-display text-2xl text-navy-950">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-slate-500">Usa una cuenta institucional. Requiere el backend en ejecución.</p>

            {LOGOUT_MESSAGES[logoutReason] ? (
              <p data-cy="logout-reason" className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {LOGOUT_MESSAGES[logoutReason]}
              </p>
            ) : null}

            <label className="mt-6 block text-sm font-medium text-slate-700">
              Correo institucional
              <input
                data-cy="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-teal-500 focus:ring-2"
                required
              />
            </label>

            <label className="mt-4 block text-sm font-medium text-slate-700">
              Contraseña
              <input
                data-cy="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-teal-500 focus:ring-2"
                required
              />
            </label>

            {error ? (
              <p data-cy="login-error" className="mt-3 text-sm text-rose-600">
                {error}
              </p>
            ) : null}

            <button
              data-cy="submit-login"
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-navy-900 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
            >
              {loading ? 'Conectando…' : 'Entrar al sistema'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
