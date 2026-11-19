import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import { useAuth } from '../../context/AuthContext'
import { fetchUsers, resetUserPassword, saveUser, toggleUserActive } from '../../api/admin'
import Usuarios from './Usuarios'

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../api/admin', () => ({ fetchUsers: vi.fn(), saveUser: vi.fn(), resetUserPassword: vi.fn(), toggleUserActive: vi.fn() }))

const users = [
  { id: 8, name: 'Ana Docente', dni: '45678901', email: 'd45678901@coar.edu.pe', role: { slug: 'teacher', name: 'Docente' }, is_active: true },
  { id: 9, name: 'Luis Quispe', dni: '78901234', email: '78901234@coar.edu.pe', role: { slug: 'student', name: 'Estudiante' }, is_active: false },
]
const LONG = { timeout: 12000 }

function renderPage() { return render(<ToastProvider><Usuarios /></ToastProvider>) }

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: (query) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }) })
})
beforeEach(() => {
  useAuth.mockReturnValue({ user: { id: 1 }, collegeHasResidence: true })
  fetchUsers.mockResolvedValue({ data: users, meta: { current_page: 1, last_page: 1, total: users.length } })
  saveUser.mockResolvedValue({ data: { email: 'admin@coar.edu.pe' }, temporary_password: 'ClaveTemporal123' })
  toggleUserActive.mockResolvedValue({ message: 'Estado actualizado.' })
  resetUserPassword.mockResolvedValue({ message: 'Contraseña restablecida.', temporary_password: 'NuevaClave123' })
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('Usuarios', () => {
  it('lista usuarios y envía los filtros de rol/estado', async () => {
    renderPage()
    expect(await screen.findByText('Ana Docente', {}, LONG)).toBeTruthy()
    expect(screen.getAllByText('Docente / Tutor').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Activo')).toBeTruthy()
    expect(screen.getByText('Inactivo')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'teacher' } })
    await waitFor(() => expect(fetchUsers).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'teacher' }), expect.anything()), LONG)
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: '0' } })
    await waitFor(() => expect(fetchUsers).toHaveBeenLastCalledWith(expect.objectContaining({ is_active: '0' }), expect.anything()), LONG)
  })

  it('crea un usuario docente y muestra la contraseña temporal solo tras el alta', async () => {
    renderPage()
    await screen.findByText('Ana Docente', {}, LONG)
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo usuario' })
    fireEvent.change(screen.getByLabelText(/^Nombre completo/), { target: { value: 'Admin COAR' } })
    fireEvent.change(screen.getByLabelText(/^DNI/), { target: { value: '12345678' } })
    fireEvent.change(screen.getByLabelText(/^Correo institucional/), { target: { value: 'admin@coar.edu.pe' } })
    fireEvent.change(screen.getByLabelText(/^Código de empleado/), { target: { value: 'EMP-01' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(saveUser).toHaveBeenCalledWith(undefined, {
      name: 'Admin COAR', email: 'admin@coar.edu.pe', dni: '12345678', role: 'teacher', profile: { employee_code: 'EMP-01' },
    }), LONG)
    expect(await screen.findByRole('dialog', { name: 'Contraseña temporal' }, LONG)).toBeTruthy()
    expect(screen.getByText('ClaveTemporal123')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('edita datos básicos sin exponer los campos de creación', async () => {
    renderPage()
    await screen.findByText('Ana Docente', {}, LONG)
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Editar usuario' })
    expect(within(dialog).queryByLabelText('Rol')).toBeNull()
    fireEvent.change(screen.getByLabelText(/^Nombre completo/), { target: { value: 'Ana Actualizada' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(saveUser).toHaveBeenCalledWith(8, {
      name: 'Ana Actualizada', email: 'd45678901@coar.edu.pe', dni: '45678901',
    }), LONG)
  })

  it('confirma activar/desactivar y restablecer contraseña', async () => {
    renderPage()
    await screen.findByText('Ana Docente', {}, LONG)
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar' }))
    await waitFor(() => expect(toggleUserActive).toHaveBeenCalledWith(8), LONG)
    expect(await screen.findByText('Estado actualizado.', {}, LONG)).toBeTruthy()

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Restablecer contraseña' }).length).toBeGreaterThan(0), LONG)
    fireEvent.click(screen.getAllByRole('button', { name: 'Restablecer contraseña' })[0])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restablecer' }))
    await waitFor(() => expect(resetUserPassword).toHaveBeenCalledWith(8), LONG)
    expect(await screen.findByText('NuevaClave123', {}, LONG)).toBeTruthy()
  })

  it('muestra errores 422 del formulario y permite reintentar la carga', async () => {
    saveUser.mockRejectedValueOnce({ status: 422, kind: 'validation', fieldErrors: { email: 'El correo ya está registrado.' } })
    renderPage()
    await screen.findByText('Ana Docente', {}, LONG)
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo usuario' }))
    fireEvent.change(screen.getByLabelText(/^Nombre completo/), { target: { value: 'Otro' } })
    fireEvent.change(screen.getByLabelText(/^DNI/), { target: { value: '12345678' } })
    fireEvent.change(screen.getByLabelText(/^Correo institucional/), { target: { value: 'admin@coar.edu.pe' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('El correo ya está registrado.', {}, LONG)).toBeTruthy()
  })
})
