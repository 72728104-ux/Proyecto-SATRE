import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserRoundCog } from 'lucide-react'
import { healthRequest } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { CHANGE_PASSWORD_PATH, ROLE_HOME } from '../data/roles'
import Field from './Field'

export default function RoleSwitcher() {
  if (!import.meta.env.DEV) return null
  return <DevAccountSwitcher />
}

function DevAccountSwitcher() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [backendUp, setBackendUp] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    healthRequest({ signal: controller.signal })
      .then((payload) => setBackendUp(payload?.status === 'ok'))
      .catch(() => setBackendUp(false))
    return () => controller.abort()
  }, [])

  if (!backendUp) return null

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await login(form.email, form.password)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setOpen(false)
    setForm({ email: '', password: '' })
    navigate(result.user.mustChangePassword ? CHANGE_PASSWORD_PATH : (ROLE_HOME[result.user.role] ?? '/403'), {
      replace: true,
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-cy="role-switcher"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15"
        aria-expanded={open}
      >
        <UserRoundCog size={16} />
        <span className="hidden sm:inline">Cambiar cuenta (dev)</span>
      </button>

      {open ? (
        <form
          onSubmit={onSubmit}
          className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-xl"
        >
          <p className="text-xs text-slate-500">Solo desarrollo · inicia sesión con otra cuenta real del backend.</p>
          <Field
            label="Correo"
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <Field
            label="Contraseña"
            name="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            error={error}
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-navy-900 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
          >
            {busy ? 'Conectando…' : 'Entrar'}
          </button>
        </form>
      ) : null}
    </div>
  )
}
