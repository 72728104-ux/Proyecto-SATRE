import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import Field from '../components/Field'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { ROLE_HOME } from '../data/roles'
import { useMutation } from '../hooks/useApi'

const MIN_LENGTH = 10
const EMPTY_FORM = { current_password: '', password: '', password_confirmation: '' }

const validate = (form) => {
  const errors = {}
  if (!form.current_password) errors.current_password = 'Ingresa tu contraseña actual.'
  if (form.password.length < MIN_LENGTH) errors.password = `Debe tener al menos ${MIN_LENGTH} caracteres.`
  else if (form.password === form.current_password) errors.password = 'Debe ser distinta de la contraseña actual.'
  if (form.password_confirmation !== form.password) errors.password_confirmation = 'Las contraseñas no coinciden.'
  return errors
}

export default function CambiarContrasena() {
  const { user, role, mustChangePassword, changePassword, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [localErrors, setLocalErrors] = useState({})
  const { mutate, loading, error, fieldErrors } = useMutation(changePassword)

  const errors = { ...fieldErrors, ...localErrors }
  const generalError = error && !Object.keys(fieldErrors).length ? error.message : null

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((current) => ({ ...current, [name]: value }))
    setLocalErrors((current) => ({ ...current, [name]: undefined }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = validate(form)
    setLocalErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    const result = await mutate(form)
    if (!result.ok) return
    setForm(EMPTY_FORM)
    toast.success('Contraseña actualizada correctamente.')
    navigate(ROLE_HOME[role] ?? '/', { replace: true })
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 p-4 sm:p-6">
      <form
        onSubmit={onSubmit}
        noValidate
        data-cy="change-password-form"
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <KeyRound className="text-teal-700" />
        <h1 className="font-display mt-3 text-2xl text-navy-950">
          {mustChangePassword ? 'Cambia tu contraseña' : 'Cambiar contraseña'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mustChangePassword
            ? 'Por seguridad, debes definir una contraseña personal antes de usar el sistema.'
            : 'Actualiza la contraseña de tu cuenta.'}
        </p>
        <p className="mt-2 text-xs text-slate-400">{user?.email}</p>

        <div className="mt-6 space-y-4">
          <Field
            label="Contraseña actual"
            name="current_password"
            type="password"
            autoComplete="current-password"
            value={form.current_password}
            onChange={onChange}
            error={errors.current_password}
            data-cy="current-password"
            required
          />
          <Field
            label="Nueva contraseña"
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={onChange}
            error={errors.password}
            hint={`Mínimo ${MIN_LENGTH} caracteres.`}
            data-cy="new-password"
            required
          />
          <Field
            label="Confirmar nueva contraseña"
            name="password_confirmation"
            type="password"
            autoComplete="new-password"
            value={form.password_confirmation}
            onChange={onChange}
            error={errors.password_confirmation}
            data-cy="new-password-confirmation"
            required
          />
        </div>

        {generalError ? <p className="mt-4 text-sm text-rose-600">{generalError}</p> : null}

        <button
          type="submit"
          disabled={loading}
          data-cy="submit-change-password"
          className="mt-6 w-full rounded-xl bg-navy-900 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
        >
          {loading ? 'Guardando…' : 'Guardar contraseña'}
        </button>

        <div className="mt-4 text-center text-sm">
          {mustChangePassword ? (
            <button type="button" onClick={() => logout()} className="text-slate-500 hover:text-navy-900">
              Cerrar sesión
            </button>
          ) : (
            <Link to={ROLE_HOME[role] ?? '/'} className="text-slate-500 hover:text-navy-900">
              Volver
            </Link>
          )}
        </div>
      </form>
    </div>
  )
}
