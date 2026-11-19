import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import { fetchAdminMetrics } from '../../api/admin'
import DashboardAdmin from './DashboardAdmin'

vi.mock('../../api/admin', () => ({ fetchAdminMetrics: vi.fn() }))

const metrics = {
  data: {
    users: { active: 12, inactive: 3, logged_in_last_30_days: 8, active_by_role: { admin: 1, teacher: 4 } },
    attendance_coverage: {
      insufficient_data: false,
      rate: 0.875,
      courses_with_attendance: 7,
      courses_total: 8,
      date_from: '2026-03-01',
      date_to: '2026-10-01',
    },
    alerts: { open: 4, open_by_severity: { CRITICO: 1, ALTO: 2, CUSTOM: 1 } },
  },
}

function renderPage() {
  return render(<ToastProvider><DashboardAdmin /></ToastProvider>)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  fetchAdminMetrics.mockResolvedValue(metrics)
})

describe('DashboardAdmin', () => {
  it('presenta métricas, desglose de alertas y usuarios por rol', async () => {
    renderPage()

    expect(await screen.findByText('12')).toBeTruthy()
    expect(screen.getByText('Métricas institucionales')).toBeTruthy()
    expect(screen.getByText('3 inactivos')).toBeTruthy()
    expect(screen.getByText('88%')).toBeTruthy()
    expect(screen.getByText('7 de 8 cursos · 2026-03-01 a 2026-10-01')).toBeTruthy()
    expect(screen.getByText('Crítica: 1 · Alta: 2 · CUSTOM: 1')).toBeTruthy()
    expect(screen.getByText('Docente / Tutor')).toBeTruthy()
  })

  it('explica cobertura insuficiente y el periodo sin tasa disponible', async () => {
    fetchAdminMetrics.mockResolvedValue({
      data: {
        users: { active: 0, inactive: 0, logged_in_last_30_days: 0 },
        attendance_coverage: { insufficient_data: true, rate: null },
        alerts: { open: 0, open_by_severity: {} },
      },
    })

    renderPage()

    expect(await screen.findByText('Sin datos')).toBeTruthy()
    expect(screen.getByText('No hay periodo vigente o cursos registrados.')).toBeTruthy()
    expect(screen.getByText('Sin alertas abiertas')).toBeTruthy()
  })

  it('muestra la carga y permite reintentar un error del servidor', async () => {
    fetchAdminMetrics.mockRejectedValueOnce({ status: 500, kind: 'http', message: 'Error temporal' })

    const { container } = renderPage()
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
    expect(await screen.findByText('No se pudo cargar la información.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByText('12')).toBeTruthy())
    expect(fetchAdminMetrics).toHaveBeenCalledTimes(2)
  })
})
