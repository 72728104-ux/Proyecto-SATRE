import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import AlertasResidencia from './AlertasResidencia'
import { fetchAlerts } from '../../api/residence'

vi.mock('../../api/residence', () => ({
  fetchAlerts: vi.fn(),
  updateAlert: vi.fn(),
  createIntervention: vi.fn(),
  createFollowUp: vi.fn(),
}))

const alert = {
  id: 9,
  student: { id: 3, name: 'Luis Quispe' },
  severity: 'CRITICO',
  title: 'Salida nocturna sin autorización',
  message: 'Se detectó fuera del pabellón.',
  status: 'acknowledged',
  created_at: '2026-10-25',
  interventions: [],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <AlertasResidencia />
      </ToastProvider>
    </MemoryRouter>,
  )
}

const LONG = { timeout: 12000 }

describe('AlertasResidencia', () => {
  beforeEach(() => {
    fetchAlerts.mockResolvedValue({ data: [alert], meta: { current_page: 1, last_page: 1, total: 1 } })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('carga las alertas de residencia sin filtro de aula', async () => {
    renderPage()

    expect(screen.getByText('Alertas residenciales')).toBeTruthy()
    expect(
      screen.getByText('Atiende las alertas de los internos y registra intervenciones y seguimiento.'),
    ).toBeTruthy()

    await waitFor(() => expect(fetchAlerts).toHaveBeenCalledWith({ status: 'open', page: 1 }, expect.anything()), LONG)
    await waitFor(() => expect(screen.getByText('Salida nocturna sin autorización')).toBeTruthy(), LONG)
    expect(screen.getByText('Luis Quispe · 25/10/2026')).toBeTruthy()
    expect(within(document.querySelector('[data-cy="alert-card"]')).getByText('En atención')).toBeTruthy()
    expect(screen.queryByLabelText('Aula')).toBeNull()
  })

  it('ofrece los tipos de intervención de residencia y valida el formulario', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Salida nocturna sin autorización')).toBeTruthy(), LONG)

    fireEvent.click(screen.getByRole('button', { name: /Intervención/ }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Intervención · Luis Quispe')

    const options = [...dialog.querySelectorAll('select option')].map((option) => option.textContent)
    expect(options).toEqual([
      'Selecciona…',
      'Entrevista con monitor',
      'Reunión con apoderado',
      'Derivación a psicología',
      'Derivación a tópico / salud',
      'Otro',
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(screen.getByText('Elige el tipo de intervención.')).toBeTruthy()
    expect(screen.getByText('Describe la intervención (mínimo 10 caracteres).')).toBeTruthy()
  })

  it('muestra el vacío con la descripción de residencia', async () => {
    fetchAlerts.mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } })
    renderPage()

    await waitFor(() => expect(screen.getByText('No hay alertas con estos filtros.')).toBeTruthy(), LONG)
    expect(screen.getByText('Aquí aparecen las alertas de riesgo de los internos.')).toBeTruthy()
  })
})
