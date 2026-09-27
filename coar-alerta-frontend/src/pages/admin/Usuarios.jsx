import { useState } from 'react'
import { resetUserPassword, saveUser, toggleUserActive, fetchUsers } from '../../api/admin'
import ConfirmModal from '../../components/ConfirmModal'
import DataTable from '../../components/DataTable'
import EmptyState from '../../components/EmptyState'
import Field from '../../components/Field'
import Modal from '../../components/Modal'
import Pagination from '../../components/Pagination'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../context/AuthContext'
import { API_ROLE_TO_UI, ROLE_LABELS } from '../../data/roles'
import { useMutation } from '../../hooks/useApi'
import { notifyError, useEditor, useFormState, usePagedList } from './shared/hooks'
import { ClassroomSelect, FilterBar, FormModal, LoadError, PageHeader, linkButton, primaryButton } from './shared/ui'

const ROLE_OPTIONS = Object.entries(API_ROLE_TO_UI).map(([slug, ui]) => ({ slug, label: ROLE_LABELS[ui] }))
const roleLabel = (role) => ROLE_LABELS[API_ROLE_TO_UI[role?.slug]] ?? role?.name ?? '—'

const PROFILE_FIELDS = {
  teacher: [
    { name: 'employee_code', label: 'Código de empleado', required: true },
    { name: 'specialty', label: 'Especialidad' },
  ],
  monitor: [{ name: 'employee_code', label: 'Código de empleado', required: true }],
  student: [
    { name: 'student_code', label: 'Código de estudiante', required: true },
    { name: 'document_number', label: 'N.º de documento', required: true },
    { name: 'first_name', label: 'Nombres', required: true },
    { name: 'last_name', label: 'Apellidos', required: true },
  ],
  guardian: [
    { name: 'document_number', label: 'N.º de documento', required: true },
    { name: 'first_name', label: 'Nombres', required: true },
    { name: 'last_name', label: 'Apellidos', required: true },
    { name: 'phone', label: 'Teléfono' },
  ],
}

function UserFormModal({ editor }) {
  const isNew = !editor.editing.id
  const { form, set, bind } = useFormState({
    name: editor.editing.name ?? '',
    email: editor.editing.email ?? '',
    role: 'teacher',
    password: '',
    profile: {},
  })
  const errors = editor.errors
  const setProfile = (name, value) => set('profile', { ...form.profile, [name]: value })

  const submit = () => {
    if (!isNew) return editor.submit({ name: form.name, email: form.email })
    const body = { name: form.name, email: form.email, role: form.role }
    if (form.password) body.password = form.password
    if (form.role !== 'admin') body.profile = form.profile
    return editor.submit(body)
  }

  return (
    <FormModal title={isNew ? 'Nuevo usuario' : 'Editar usuario'} onClose={editor.close} onSubmit={submit} loading={editor.loading}>
      <Field label="Nombre completo" {...bind('name')} error={errors.name} required autoFocus />
      <Field label="Correo" type="email" {...bind('email')} error={errors.email} required />
      {isNew ? (
        <>
          <Field
            as="select"
            label="Rol"
            name="role"
            value={form.role}
            onChange={(e) => {
              set('role', e.target.value)
              set('profile', {})
            }}
            error={errors.role}
            required
          >
            {ROLE_OPTIONS.map(({ slug, label }) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </Field>
          <Field
            label="Contraseña inicial"
            type="password"
            autoComplete="new-password"
            {...bind('password')}
            error={errors.password}
            hint="Opcional. Si la dejas vacía se genera una temporal. Mínimo 10 caracteres."
          />
          {(PROFILE_FIELDS[form.role] ?? []).map((field) => (
            <Field
              key={field.name}
              label={field.label}
              name={`profile.${field.name}`}
              value={form.profile[field.name] ?? ''}
              onChange={(e) => setProfile(field.name, e.target.value)}
              error={errors[`profile.${field.name}`]}
              required={field.required}
            />
          ))}
          {form.role === 'student' ? (
            <>
              <ClassroomSelect
                label="Aula"
                name="profile.classroom_id"
                placeholder="Sin aula asignada"
                value={form.profile.classroom_id}
                onChange={(value) => setProfile('classroom_id', value)}
                error={errors['profile.classroom_id']}
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.profile.is_boarder)}
                  onChange={(e) => setProfile('is_boarder', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Reside en el internado
              </label>
            </>
          ) : null}
          {errors.profile ? <p className="text-xs text-rose-600">{errors.profile}</p> : null}
        </>
      ) : null}
    </FormModal>
  )
}

function TemporaryPasswordModal({ credentials, onClose }) {
  return (
    <Modal open={Boolean(credentials)} title="Contraseña temporal" onClose={onClose}>
      <p className="text-sm text-slate-600">
        Entrega esta contraseña a <strong>{credentials?.email}</strong>. Solo se muestra una vez y deberá cambiarla al
        iniciar sesión.
      </p>
      <p className="mt-4 select-all break-all rounded-xl bg-slate-100 px-4 py-3 font-mono text-lg text-navy-950">
        {credentials?.password}
      </p>
      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onClose} className={primaryButton}>
          Entendido
        </button>
      </div>
    </Modal>
  )
}

export default function Usuarios() {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  const list = usePagedList(fetchUsers, { search: '', role: '', is_active: '' })
  const [credentials, setCredentials] = useState(null)
  const [pending, setPending] = useState(null)

  const editor = useEditor(saveUser, {
    created: 'Usuario creado.',
    onSaved: (response, { created }) => {
      list.reload()
      if (created && response.temporary_password) {
        setCredentials({ email: response.data.email, password: response.temporary_password })
      }
    },
  })

  const action = useMutation(({ type, user }) => (type === 'toggle' ? toggleUserActive(user.id) : resetUserPassword(user.id)), {
    onError: (error) => notifyError(toast, error),
  })

  const confirmAction = async () => {
    const result = await action.mutate(pending)
    const { type, user } = pending
    setPending(null)
    if (!result.ok) return
    toast.success(result.data.message)
    if (type === 'reset') setCredentials({ email: user.email, password: result.data.temporary_password })
    list.reload()
  }

  const columns = [
    { key: 'name', header: 'Nombre', primary: true },
    { key: 'email', header: 'Correo' },
    { key: 'role', header: 'Rol', render: (row) => roleLabel(row.role) },
    {
      key: 'is_active',
      header: 'Estado',
      render: (row) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            row.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {row.is_active ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (row) => (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <button type="button" className={linkButton} onClick={() => editor.open(row)}>
            Editar
          </button>
          {row.id !== currentUser?.id ? (
            <>
              <button type="button" className={linkButton} onClick={() => setPending({ type: 'toggle', user: row })}>
                {row.is_active ? 'Desactivar' : 'Activar'}
              </button>
              <button type="button" className={linkButton} onClick={() => setPending({ type: 'reset', user: row })}>
                Restablecer contraseña
              </button>
            </>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gestión de usuarios"
        description="Altas, datos de acceso y estado de las cuentas."
        actionLabel="Nuevo usuario"
        onAction={() => editor.open()}
      />

      <FilterBar>
        <Field
          label="Buscar"
          type="search"
          name="search"
          placeholder="Nombre o correo"
          value={list.filters.search}
          onChange={(e) => list.setFilter('search', e.target.value)}
          className="sm:col-span-2"
        />
        <Field as="select" label="Rol" name="role" value={list.filters.role} onChange={(e) => list.setFilter('role', e.target.value)}>
          <option value="">Todos</option>
          {ROLE_OPTIONS.map(({ slug, label }) => (
            <option key={slug} value={slug}>
              {label}
            </option>
          ))}
        </Field>
        <Field
          as="select"
          label="Estado"
          name="is_active"
          value={list.filters.is_active}
          onChange={(e) => list.setFilter('is_active', e.target.value)}
        >
          <option value="">Todos</option>
          <option value="1">Activos</option>
          <option value="0">Inactivos</option>
        </Field>
      </FilterBar>

      {list.error && !list.data ? (
        <LoadError onRetry={list.reload} />
      ) : (
        <DataTable
          columns={columns}
          rows={list.rows}
          loading={list.loading}
          empty={<EmptyState title="No hay usuarios con esos filtros." description="Ajusta la búsqueda o crea un usuario nuevo." />}
        />
      )}
      <Pagination meta={list.meta} onPageChange={list.setPage} disabled={list.loading} />

      {editor.editing ? <UserFormModal key={editor.editing.id ?? 'new'} editor={editor} /> : null}

      <ConfirmModal
        open={Boolean(pending)}
        loading={action.loading}
        danger={pending?.type === 'toggle' && pending.user.is_active}
        title={
          pending?.type === 'reset'
            ? 'Restablecer contraseña'
            : pending?.user.is_active
              ? 'Desactivar usuario'
              : 'Activar usuario'
        }
        message={
          pending?.type === 'reset'
            ? `Se generará una contraseña temporal para ${pending.user.name} y deberá cambiarla al ingresar.`
            : pending?.user.is_active
              ? `${pending.user.name} no podrá iniciar sesión y se cerrarán sus sesiones abiertas.`
              : `${pending?.user.name} podrá volver a iniciar sesión.`
        }
        confirmLabel={pending?.type === 'reset' ? 'Restablecer' : pending?.user.is_active ? 'Desactivar' : 'Activar'}
        onConfirm={confirmAction}
        onCancel={() => setPending(null)}
      />

      <TemporaryPasswordModal credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  )
}
