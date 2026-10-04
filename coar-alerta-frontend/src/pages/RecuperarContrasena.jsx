import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { forgotPasswordRequest } from '../api/auth'
import Field from '../components/Field'
import { useMutation } from '../hooks/useApi'

export default function RecuperarContrasena() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const { mutate, loading, error, fieldErrors } = useMutation(forgotPasswordRequest, {
    onSuccess: () => setSent(true),
  })
  const generalError = error && !Object.keys(fieldErrors).length ? error.message : null

  const onSubmit = (e) => {
    e.preventDefault()
    mutate(email)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 p-4 sm:p-6">
      <form
        onSubmit={onSubmit}
        noValidate
        data-cy="forgot-password-form"
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <Mail className="text-teal-700" />
        <h1 className="font-display mt-3 text-2xl text-navy-950">Recuperar contraseña</h1>
        <p className="mt-1 text-sm text-slate-500">
          Si el correo está registrado, recibirás un enlace válido por 60 minutos.
        </p>

        {sent ? (
          <p data-cy="forgot-password-sent" className="mt-6 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            <Field
              label="Correo institucional"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              data-cy="forgot-email"
              required
            />
            {generalError ? <p className="text-sm text-rose-600">{generalError}</p> : null}
            <button
              type="submit"
              disabled={loading}
              data-cy="submit-forgot-password"
              className="w-full rounded-xl bg-navy-900 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
            >
              {loading ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </div>
        )}

        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-slate-500 hover:text-navy-900">
            Volver al inicio de sesión
          </Link>
        </p>
      </form>
    </div>
  )
}
