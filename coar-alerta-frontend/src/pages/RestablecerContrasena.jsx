import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { resetPasswordRequest } from '../api/auth'
import EmptyState from '../components/EmptyState'
import Field from '../components/Field'
import { useToast } from '../components/Toast'
import { FORGOT_PASSWORD_PATH } from '../data/roles'
import { useMutation } from '../hooks/useApi'

const MIN_LENGTH = 10
const EMPTY_FORM = { password: '', password_confirmation: '' }

const validate = (form) => {
  const errors = {}
  if (form.password.length < MIN_LENGTH) errors.password = `Debe tener al menos ${MIN_LENGTH} caracteres.`
  if (form.password_confirmation !== form.password) errors.password_confirmation = 'Las contraseñas no coinciden.'
  return errors
}

export default function RestablecerContrasena() {
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''
  const [form, setForm] = useState(EMPTY_FORM)
  const [localErrors, setLocalErrors] = useState({})
  const { mutate, loading, error, fieldErrors } = useMutation(resetPasswordRequest)

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

    const result = await mutate({ token, email, ...form })
    if (!result.ok) return
    toast.success('Contraseña restablecida. Inicia sesión con tu nueva contraseña.')
    navigate('/login', { replace: true })
  }

  if (!token || !email) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-50 p-4">
        <EmptyState
          title="Enlace incompleto"
          description="Abre el enlace que llegó a tu correo. Si expiró, solicita uno nuevo."
          action={
            <Link
              to={FORGOT_PASSWORD_PATH}
              className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800"
            >
              Solicitar enlace
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 p-4 sm:p-6">
      <form
        onSubmit={onSubmit}
        noValidate
        data-cy="reset-password-form"
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <KeyRound className="text-teal-700" />
        <h1 className="font-display mt-3 text-2xl text-navy-950">Nueva contraseña</h1>
        <p className="mt-1 text-sm text-slate-500">Define una contraseña de al menos {MIN_LENGTH} caracteres.</p>
        <p className="mt-2 text-xs text-slate-400">{email}</p>

        <div className="mt-6 space-y-4">
          <Field
            label="Nueva contraseña"
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={onChange}
            error={errors.password}
            hint={`Mínimo ${MIN_LENGTH} caracteres.`}
            data-cy="reset-password"
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
            data-cy="reset-password-confirmation"
            required
          />
        </div>

        {generalError ? <p className="mt-4 text-sm text-rose-600">{generalError}</p> : null}

        <button
          type="submit"
          disabled={loading}
          data-cy="submit-reset-password"
          className="mt-6 w-full rounded-xl bg-navy-900 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
        >
          {loading ? 'Guardando…' : 'Restablecer contraseña'}
        </button>

        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-slate-500 hover:text-navy-900">
            Volver al inicio de sesión
          </Link>
        </p>
      </form>
    </div>
  )
}
