import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CoarLogo from '../components/CoarLogo'
import Field from '../components/Field'
import { CHANGE_PASSWORD_PATH, FORGOT_PASSWORD_PATH, ROLE_HOME } from '../data/roles'
import { useAuth } from '../context/AuthContext'

const LOGOUT_MESSAGES = {
  inactivity: 'Tu sesión se cerró tras 30 minutos de inactividad.',
  expired: 'Tu sesión expiró. Vuelve a iniciar sesión.',
}

export default function Login() {
  const { login, logoutReason } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setLoading(true)
    const result = await login(email.trim(), password)
    setLoading(false)
    if (!result.ok) {
      setError(result.message)
      setFieldErrors(result.fieldErrors ?? {})
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
          <div className="flex items-center gap-3">
            <CoarLogo size={48} />
            <p className="text-sm uppercase tracking-[0.22em] text-teal-300">COAR Junín</p>
          </div>
          <h1 className="font-display mt-6 max-w-md text-4xl leading-tight">
            Sistema web de alerta temprana para retención estudiantil
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Acceso por rol (admin, docente, monitor, estudiante y apoderado) con sesión protegida y cambio de contraseña
            obligatorio en el primer ingreso.
          </p>
        </div>
        <p className="relative text-sm text-white/50">SATRE · API Laravel</p>
      </section>

      <section className="flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3">
            <CoarLogo size={40} />
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-teal-700">SATRE</p>
              <p className="font-semibold text-navy-950">COAR Junín</p>
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            noValidate
            data-cy="login-form"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <h2 className="font-display text-2xl text-navy-950">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-slate-500">Usa tu correo institucional o tu DNI de 8 dígitos.</p>

            {LOGOUT_MESSAGES[logoutReason] ? (
              <p data-cy="logout-reason" className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {LOGOUT_MESSAGES[logoutReason]}
              </p>
            ) : null}

            <div className="mt-6 space-y-4">
              <Field
                label="Correo institucional o DNI"
                name="email"
                type="text"
                inputMode="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email}
                hint="Ejemplo: 78901234 o 78901234@coar.edu.pe"
                data-cy="email"
                required
              />
              <Field
                label="Contraseña"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
                data-cy="password"
                required
              />
            </div>

            {error && !fieldErrors.email && !fieldErrors.password ? (
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

            <p className="mt-4 text-center text-sm">
              <Link to={FORGOT_PASSWORD_PATH} className="text-slate-500 hover:text-navy-900">
                Olvidé mi contraseña
              </Link>
            </p>
            <p className="mt-2 text-center text-sm">
              <Link to="/" data-cy="volver-portal" className="text-slate-500 hover:text-navy-900">
                Volver al portal institucional
              </Link>
            </p>
          </form>
        </div>
      </section>
    </div>
  )
}
