import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client.js', () => ({ apiRequest: vi.fn() }))

const { apiRequest } = await import('./client.js')
const {
  createFollowUp,
  createIntervention,
  fetchAlerts,
  fetchIncidents,
  fetchPermissions,
  fetchPresences,
  fetchResidents,
  resolvePermission,
  saveIncident,
  savePresencesBulk,
  updateAlert,
  updatePresence,
} = await import('./residence.js')

const signal = new AbortController().signal

describe('api/residence', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    apiRequest.mockResolvedValue({ data: [], meta: {} })
  })

  afterEach(() => {
    apiRequest.mockReset()
  })

  it('fetchResidents y fetchPresences filtran la query y reenvían opciones', async () => {
    await fetchResidents({ presence_date: '2026-10-27', search: 'ana' }, { signal })
    expect(apiRequest).toHaveBeenCalledWith('/residents?presence_date=2026-10-27&search=ana', {
      signal,
    })

    await fetchPresences({ status: 'absent', check_type: '' })
    expect(apiRequest).toHaveBeenCalledWith('/presences?status=absent', undefined)
  })

  it('updatePresence usa PUT sobre el registro', async () => {
    const body = { status: 'absent', notes: 'Sin aviso' }
    await updatePresence(12, body)
    expect(apiRequest).toHaveBeenCalledWith('/presences/12', { method: 'PUT', body })
  })

  it('savePresencesBulk publica el lote completo', async () => {
    const body = {
      presence_date: '2026-10-27',
      check_type: 'night',
      records: [{ student_id: 3, status: 'present', notes: null }],
    }
    await savePresencesBulk(body)
    expect(apiRequest).toHaveBeenCalledWith('/presences/bulk', { method: 'POST', body })
  })

  it('fetchIncidents filtra y saveIncident crea o actualiza', async () => {
    await fetchIncidents({ status: 'open', severity: 'grave' })
    expect(apiRequest).toHaveBeenCalledWith('/incidents?status=open&severity=grave', undefined)

    const body = { category: 'conducta', description: 'Interrupción' }
    await saveIncident(null, body)
    expect(apiRequest).toHaveBeenCalledWith('/incidents', { method: 'POST', body })

    await saveIncident(15, body)
    expect(apiRequest).toHaveBeenCalledWith('/incidents/15', { method: 'PUT', body })
  })

  it('fetchPermissions filtra y resolvePermission usa PATCH con la decisión', async () => {
    await fetchPermissions({ status: 'approved_guardian' })
    expect(apiRequest).toHaveBeenCalledWith('/permissions?status=approved_guardian', undefined)

    await resolvePermission(21, 'approved')
    expect(apiRequest).toHaveBeenCalledWith('/permissions/21/resolve', {
      method: 'PATCH',
      body: { decision: 'approved' },
    })
  })

  it('reexporta las alertas del contrato docente', async () => {
    await fetchAlerts({ status: 'open' })
    expect(apiRequest).toHaveBeenCalledWith('/alerts?status=open', undefined)

    await updateAlert(4, { status: 'acknowledged' })
    expect(apiRequest).toHaveBeenCalledWith('/alerts/4', {
      method: 'PATCH',
      body: { status: 'acknowledged' },
    })

    await createIntervention(4, { type: 'otro', description: 'Derivación' })
    expect(apiRequest).toHaveBeenCalledWith('/alerts/4/interventions', {
      method: 'POST',
      body: { type: 'otro', description: 'Derivación' },
    })

    await createFollowUp(9, { notes: 'Sin cambios' })
    expect(apiRequest).toHaveBeenCalledWith('/interventions/9/follow-ups', {
      method: 'POST',
      body: { notes: 'Sin cambios' },
    })
  })
})
