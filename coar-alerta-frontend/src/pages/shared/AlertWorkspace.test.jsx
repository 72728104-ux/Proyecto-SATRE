import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import AlertWorkspace, { ALERT_STATUS, AlertCard, FOLLOW_UP_OUTCOMES } from './AlertWorkspace'

const LONG = { timeout: 12000 }

const interventionTypes = [
  { value: 'tutoria', label: 'Tutoría individual' },
  { value: 'otro', label: 'Otro' },
]

const openAlert = {
  id: 1,
  student_id: 3,
  student: { id: 3, name: 'Valeria Chávez' },
  severity: 'ALTO',
  title: 'Riesgo académico',
  message: 'Bajó sus notas en Matemáticas.',
  status: 'open',
  created_at: '2026-10-20',
  interventions: [
    {
      id: 11,
      type: 'tutoria',
      description: 'Entrevista inicial con la estudiante.',
      created_at: '2026-10-21',
      follow_ups: [
        { id: 21, follow_up_date: '2026-10-22', outcome: 'mejora', notes: 'Participa más en clase.' },
      ],
    },
  ],
}

const acknowledgedAlert = {
  id: 2,
  student_id: 4,
  severity: 'MEDIO',
  title: 'Alerta sin estudiante embebido',
  message: 'Sin nombre en el payload.',
  status: 'acknowledged',
  created_at: null,
  interventions: [],
}

const resolvedAlert = {
  id: 3,
  student: { id: 5, name: 'Luis Quispe' },
  severity: 'BAJO',
  title: 'Alerta ya resuelta',
  message: 'Cerrada.',
  status: 'resolved',
  created_at: '2026-10-01',
}

const defaultPageMeta = (rows) => ({
  current_page: 1,
  last_page: 1,
  total: rows.length,
  from: rows.length ? 1 : null,
  to: rows.length || null,
})

function page(rows, meta = defaultPageMeta(rows)) {
  return { data: rows, meta }
}

function renderWorkspace(props = {}) {
  const fetchAlerts = props.fetchAlerts ?? vi.fn().mockResolvedValue(page([openAlert]))
  const updateAlert = props.updateAlert ?? vi.fn().mockResolvedValue({ data: {} })
  const createIntervention = props.createIntervention ?? vi.fn().mockResolvedValue({ data: {} })
  const createFollowUp = props.createFollowUp ?? vi.fn().mockResolvedValue({ data: {} })

  const utils = render(
    <MemoryRouter>
      <ToastProvider>
        <AlertWorkspace
          title="Alertas de prueba"
          description="Descripción de prueba"
          dataCy="alertas-test"
          interventionTypes={interventionTypes}
          emptyDescription="Aquí aparecen las alertas."
          {...props}
          fetchAlerts={fetchAlerts}
          updateAlert={updateAlert}
          createIntervention={createIntervention}
          createFollowUp={createFollowUp}
        />
      </ToastProvider>
    </MemoryRouter>,
  )

  return { ...utils, fetchAlerts, updateAlert, createIntervention, createFollowUp }
}

const cards = () => document.querySelectorAll('[data-cy="alert-card"]')

describe('AlertWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('exporta los catálogos de estado y resultados de seguimiento', () => {
    expect(ALERT_STATUS).toEqual({
      open: { label: 'Abierta', badge: 'critico' },
      acknowledged: { label: 'En atención', badge: 'pendiente_residencia' },
      resolved: { label: 'Resuelta', badge: 'autorizado' },
    })
    expect(FOLLOW_UP_OUTCOMES.map((item) => item.value)).toEqual(['mejora', 'sin_cambios', 'empeora'])
  })

  it('muestra el esqueleto de carga mientras llega la primera página', () => {
    renderWorkspace({ fetchAlerts: vi.fn(() => new Promise(() => {})) })
    expect(screen.getByText('Alertas de prueba')).toBeTruthy()
    expect(screen.getByText('Cargando…')).toBeTruthy()
  })

  it('muestra el error con reintento y vuelve a pedir la lista', async () => {
    const fetchAlerts = vi
      .fn()
      .mockRejectedValueOnce({ status: 500, message: 'Servidor caído' })
      .mockResolvedValue(page([openAlert]))
    renderWorkspace({ fetchAlerts })

    await waitFor(() => expect(screen.getByText('No se pudo cargar la información.')).toBeTruthy(), LONG)
    expect(cards()).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(cards()).toHaveLength(1), LONG)
    expect(fetchAlerts).toHaveBeenCalledTimes(2)
  })

  it('trata el 404 como módulo aún no publicado', async () => {
    renderWorkspace({ fetchAlerts: vi.fn().mockRejectedValue({ status: 404, message: 'Not found' }) })

    await waitFor(() => expect(screen.getByText('Las alertas aún no están disponibles.')).toBeTruthy(), LONG)
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
  })

  it('muestra el estado vacío con el título y la descripción configurables', async () => {
    renderWorkspace({ fetchAlerts: vi.fn().mockResolvedValue(page([])) })

    await waitFor(() => expect(screen.getByText('No hay alertas con estos filtros.')).toBeTruthy(), LONG)
    expect(screen.getByText('Aquí aparecen las alertas.')).toBeTruthy()
  })

  it('renderiza alertas, intervenciones, seguimientos y estados alternativos', async () => {
    renderWorkspace({
      fetchAlerts: vi.fn().mockResolvedValue(page([openAlert, acknowledgedAlert, resolvedAlert])),
    })

    await waitFor(() => expect(cards()).toHaveLength(3), LONG)

    const [first, second, third] = cards()
    expect(within(first).getByText('Valeria Chávez · 20/10/2026')).toBeTruthy()
    expect(within(first).getByText('Riesgo académico')).toBeTruthy()
    expect(within(first).getByText('Abierta')).toBeTruthy()
    expect(within(first).getByText('Tutoría individual')).toBeTruthy()
    expect(within(first).getByText('Entrevista inicial con la estudiante.')).toBeTruthy()
    expect(within(first).getByText(/22\/10\/2026/)).toBeTruthy()
    expect(within(first).getByText(/Mejora/)).toBeTruthy()
    expect(within(first).getByRole('button', { name: /Seguimiento/ })).toBeTruthy()

    // Sin student embebido usa el id y fecha vacía → "—"; estado acknowledged.
    expect(within(second).getByText('Estudiante #4 · —')).toBeTruthy()
    expect(within(second).getByText('En atención')).toBeTruthy()
    expect(within(second).queryByRole('button', { name: /Marcar en atención/ })).toBeNull()

    // Alerta resuelta: sin acciones ni seguimiento.
    expect(within(third).getByText('Resuelta')).toBeTruthy()
    expect(within(third).queryByRole('button', { name: /Intervención/ })).toBeNull()
    expect(within(third).queryByRole('button', { name: /Resolver/ })).toBeNull()
  })

  it('cambia el filtro de estado y usa los filtros extra', async () => {
    const setFilterSpy = vi.fn()
    const extraFilters = ({ list }) => (
      <button
        type="button"
        onClick={() => {
          setFilterSpy()
          list.setFilter('classroom_id', 7)
        }}
      >
        Filtrar aula
      </button>
    )
    const fetchAlerts = vi.fn().mockResolvedValue(page([openAlert]))
    renderWorkspace({ fetchAlerts, initialFilters: { status: 'open', classroom_id: null }, extraFilters })

    await waitFor(() => expect(fetchAlerts).toHaveBeenCalledWith({ status: 'open', classroom_id: null, page: 1 }, expect.anything()), LONG)

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: '' } })
    await waitFor(
      () => expect(fetchAlerts).toHaveBeenLastCalledWith({ status: '', classroom_id: null, page: 1 }, expect.anything()),
      LONG,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Filtrar aula' }))
    expect(setFilterSpy).toHaveBeenCalled()
    await waitFor(
      () => expect(fetchAlerts).toHaveBeenLastCalledWith({ status: '', classroom_id: 7, page: 1 }, expect.anything()),
      LONG,
    )
  })

  it('pagina los resultados', async () => {
    const fetchAlerts = vi.fn().mockResolvedValue(
      page([openAlert, acknowledgedAlert], { current_page: 1, last_page: 3, total: 30, from: 1, to: 2 }),
    )
    renderWorkspace({ fetchAlerts })

    await waitFor(() => expect(screen.getByText('Mostrando 1–2 de 30')).toBeTruthy(), LONG)

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    await waitFor(() => expect(fetchAlerts).toHaveBeenLastCalledWith({ status: 'open', page: 2 }, expect.anything()), LONG)
  })

  it('marca una alerta en atención y recarga la lista', async () => {
    const updateAlert = vi.fn().mockResolvedValue({ data: {} })
    const fetchAlerts = vi.fn().mockResolvedValue(page([openAlert]))
    renderWorkspace({ fetchAlerts, updateAlert })

    await waitFor(() => expect(cards()).toHaveLength(1), LONG)
    fireEvent.click(within(cards()[0]).getByRole('button', { name: /Marcar en atención/ }))

    await waitFor(() => expect(updateAlert).toHaveBeenCalledWith(1, { status: 'acknowledged' }), LONG)
    await waitFor(() => expect(screen.getByText('Alerta marcada en atención.')).toBeTruthy(), LONG)
    await waitFor(() => expect(fetchAlerts).toHaveBeenCalledTimes(2), LONG)
  })

  it('resuelve con confirmación y permite cancelar', async () => {
    const updateAlert = vi.fn().mockResolvedValue({ data: {} })
    renderWorkspace({ fetchAlerts: vi.fn().mockResolvedValue(page([openAlert])), updateAlert })

    await waitFor(() => expect(cards()).toHaveLength(1), LONG)

    fireEvent.click(within(cards()[0]).getByRole('button', { name: /Resolver/ }))
    let dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('¿Resolver alerta?')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(updateAlert).not.toHaveBeenCalled()

    fireEvent.click(within(cards()[0]).getByRole('button', { name: /Resolver/ }))
    dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resolver' }))

    await waitFor(() => expect(updateAlert).toHaveBeenCalledWith(1, { status: 'resolved' }), LONG)
    await waitFor(() => expect(screen.getByText('Alerta resuelta.')).toBeTruthy(), LONG)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('mantiene el modal abierto si falla la resolución', async () => {
    const updateAlert = vi.fn().mockRejectedValue({ status: 500, message: 'No se pudo cerrar.' })
    renderWorkspace({ fetchAlerts: vi.fn().mockResolvedValue(page([openAlert])), updateAlert })

    await waitFor(() => expect(cards()).toHaveLength(1), LONG)
    fireEvent.click(within(cards()[0]).getByRole('button', { name: /Resolver/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Resolver' }))

    await waitFor(() => expect(screen.getByText('No se pudo cerrar.')).toBeTruthy(), LONG)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('valida la intervención en cliente y la registra al completarla', async () => {
    const createIntervention = vi.fn().mockResolvedValue({ data: {} })
    const fetchAlerts = vi.fn().mockResolvedValue(page([openAlert]))
    renderWorkspace({ fetchAlerts, createIntervention })

    await waitFor(() => expect(cards()).toHaveLength(1), LONG)
    fireEvent.click(within(cards()[0]).getByRole('button', { name: /Intervención/ }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Intervención · Valeria Chávez')).toBeTruthy()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }))
    expect(within(dialog).getByText('Elige el tipo de intervención.')).toBeTruthy()
    expect(within(dialog).getByText('Describe la intervención (mínimo 10 caracteres).')).toBeTruthy()
    expect(createIntervention).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText(/Tipo/), { target: { value: 'tutoria' } })
    fireEvent.change(within(dialog).getByLabelText(/Descripción/), { target: { value: 'Corto' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }))
    expect(within(dialog).getByText('Describe la intervención (mínimo 10 caracteres).')).toBeTruthy()
    expect(createIntervention).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText(/Descripción/), {
      target: { value: '  Entrevista de seguimiento con la estudiante.  ' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }))

    await waitFor(
      () =>
        expect(createIntervention).toHaveBeenCalledWith(1, {
          type: 'tutoria',
          description: 'Entrevista de seguimiento con la estudiante.',
        }),
      LONG,
    )
    await waitFor(() => expect(screen.getByText('Intervención registrada.')).toBeTruthy(), LONG)
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(fetchAlerts).toHaveBeenCalledTimes(2), LONG)
  })

  it('muestra los errores 422 del servidor en los campos de la intervención', async () => {
    const createIntervention = vi
      .fn()
      .mockRejectedValue({ status: 422, fieldErrors: { description: 'La descripción ya fue registrada.' } })
    renderWorkspace({ fetchAlerts: vi.fn().mockResolvedValue(page([openAlert])), createIntervention })

    await waitFor(() => expect(cards()).toHaveLength(1), LONG)
    fireEvent.click(within(cards()[0]).getByRole('button', { name: /Intervención/ }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Tipo/), { target: { value: 'otro' } })
    fireEvent.change(within(dialog).getByLabelText(/Descripción/), {
      target: { value: 'Descripción suficientemente larga.' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }))

    await waitFor(() => expect(within(dialog).getByText('La descripción ya fue registrada.')).toBeTruthy(), LONG)
    expect(screen.getByText('Revisa los campos marcados.')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('valida el seguimiento (fecha y notas) y lo registra', async () => {
    const createFollowUp = vi.fn().mockResolvedValue({ data: {} })
    const fetchAlerts = vi.fn().mockResolvedValue(page([openAlert]))
    renderWorkspace({ fetchAlerts, createFollowUp })

    await waitFor(() => expect(cards()).toHaveLength(1), LONG)
    fireEvent.click(within(cards()[0]).getByRole('button', { name: /Seguimiento/ }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Registrar seguimiento')).toBeTruthy()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(within(dialog).getByText('Indica la fecha.')).toBeTruthy()
    expect(within(dialog).getByText('Registra lo observado en el seguimiento.')).toBeTruthy()
    expect(createFollowUp).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2999-01-01' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(within(dialog).getByText('La fecha no puede ser futura.')).toBeTruthy()
    expect(createFollowUp).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText(/Fecha/), { target: { value: '2026-01-15' } })
    fireEvent.change(within(dialog).getByLabelText(/Resultado/), { target: { value: 'empeora' } })
    fireEvent.change(within(dialog).getByLabelText(/Notas/), { target: { value: '  Se observa retroceso.  ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(
      () =>
        expect(createFollowUp).toHaveBeenCalledWith(11, {
          follow_up_date: '2026-01-15',
          outcome: 'empeora',
          notes: 'Se observa retroceso.',
        }),
      LONG,
    )
    await waitFor(() => expect(screen.getByText('Seguimiento registrado.')).toBeTruthy(), LONG)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('AlertCard expone callbacks y oculta acciones cuando está resuelta', () => {
    const onAcknowledge = vi.fn()
    const onResolve = vi.fn()
    const onIntervene = vi.fn()
    const onFollowUp = vi.fn()
    const props = { busy: false, interventionTypes, onAcknowledge, onResolve, onIntervene, onFollowUp }

    const { rerender } = render(<AlertCard alert={openAlert} {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Intervención/ }))
    fireEvent.click(screen.getByRole('button', { name: /Marcar en atención/ }))
    fireEvent.click(screen.getByRole('button', { name: /Resolver/ }))
    fireEvent.click(screen.getByRole('button', { name: /Seguimiento/ }))
    expect(onIntervene).toHaveBeenCalledWith(openAlert)
    expect(onAcknowledge).toHaveBeenCalledWith(openAlert)
    expect(onResolve).toHaveBeenCalledWith(openAlert)
    expect(onFollowUp).toHaveBeenCalledWith(openAlert.interventions[0])

    rerender(<AlertCard alert={{ ...openAlert, status: 'desconocido', interventions: [] }} {...props} />)
    expect(screen.getByText('desconocido')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Seguimiento/ })).toBeNull()
  })
})
