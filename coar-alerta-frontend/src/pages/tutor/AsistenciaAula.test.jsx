import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import { fetchAttendanceSession, fetchTeacherCourses, saveAttendanceSession } from '../../api/teacher'
import AsistenciaAula from './AsistenciaAula'

vi.mock('../../api/teacher', () => ({ fetchAttendanceSession: vi.fn(), fetchTeacherCourses: vi.fn(), saveAttendanceSession: vi.fn() }))

const courses = { data: [{ id: 5, name: 'Matemáticas AA', classroom: { id: 1, name: '5to A' } }] }
const session = {
  data: {
    classroom: { name: '5to A' },
    students: [
      { student_id: 3, student_code: 'EST-0003', first_name: 'Valeria', last_name: 'Chávez Poma', status: null, notes: null },
      { student_id: 4, student_code: 'EST-0004', first_name: 'Luis', last_name: 'Quispe', status: 'present', notes: null },
    ],
  },
}
const LONG = { timeout: 12000 }
function renderPage() { return render(<ToastProvider><AsistenciaAula /></ToastProvider>) }

afterEach(() => { cleanup(); vi.clearAllMocks() })
beforeEach(() => {
  fetchTeacherCourses.mockResolvedValue(courses)
  fetchAttendanceSession.mockResolvedValue(session)
  saveAttendanceSession.mockResolvedValue({ data: [] })
})

describe('AsistenciaAula', () => {
  it('carga el aula, marca pendientes y registra la sesión completa', async () => {
    renderPage()
    expect(await screen.findByText('Chávez Poma, Valeria', {}, LONG)).toBeTruthy()
    expect(screen.getByText('Aula 5to A · 2 estudiantes · estados IB: presente, tardanza, falta justificada e injustificada.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pendientes como presentes' }))
    expect(screen.getByText('1 cambio(s) sin guardar')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar asistencia' }))

    await waitFor(() => expect(saveAttendanceSession).toHaveBeenCalledWith(expect.objectContaining({
      course_id: 5,
      attendance_date: expect.any(String),
      records: [
        { student_id: 3, status: 'present', notes: null },
        { student_id: 4, status: 'present', notes: null },
      ],
    })), LONG)
    expect(await screen.findByText('Asistencia de 2 estudiantes guardada.', {}, LONG)).toBeTruthy()
  })

  it('captura cambios individuales y muestra errores 422 por registro', async () => {
    saveAttendanceSession.mockRejectedValueOnce({
      status: 422,
      kind: 'validation',
      fieldErrors: { 'records.0.notes': 'La observación es obligatoria.' },
    })
    renderPage()
    await screen.findByText('Chávez Poma, Valeria', {}, LONG)
    fireEvent.click(screen.getAllByRole('radio', { name: 'Falta injustificada' })[0])
    fireEvent.change(screen.getByLabelText('Observación'), { target: { value: '  Sin aviso  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar asistencia' }))

    expect(await screen.findByText('La observación es obligatoria.', {}, LONG)).toBeTruthy()
    expect(saveAttendanceSession).toHaveBeenCalledWith(expect.objectContaining({
      records: expect.arrayContaining([{ student_id: 3, status: 'absent_unjustified', notes: 'Sin aviso' }]),
    }))
  })

  it('avisa cuando el curso no tiene estudiantes y no envía una lista vacía', async () => {
    fetchAttendanceSession.mockResolvedValue({ data: { students: [] } })
    renderPage()
    expect(await screen.findByText('No hay estudiantes matriculados en este curso.', {}, LONG)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pendientes como presentes' }))
    expect(await screen.findByText('No hay estudiantes matriculados en este curso.')).toBeTruthy()
    expect(saveAttendanceSession).not.toHaveBeenCalled()
  })

  it('muestra la carga y permite reintentar un error del listado', async () => {
    fetchAttendanceSession.mockRejectedValueOnce({ status: 500, kind: 'http', message: 'Error temporal' })
    renderPage()
    expect(await screen.findByText('No se pudo cargar la información.', {}, LONG)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Chávez Poma, Valeria', {}, LONG)).toBeTruthy()
    expect(fetchAttendanceSession).toHaveBeenCalledTimes(2)
  })

  it('muestra el estado vacío si el docente no tiene cursos', async () => {
    fetchTeacherCourses.mockResolvedValue({ data: [] })
    renderPage()
    expect(await screen.findByText('No tienes cursos asignados.', {}, LONG)).toBeTruthy()
    expect(screen.getByText('Pide a administración que te asigne cursos del periodo vigente.')).toBeTruthy()
  })
})
