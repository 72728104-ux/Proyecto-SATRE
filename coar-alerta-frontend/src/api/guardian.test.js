import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client.js', () => ({ apiRequest: vi.fn() }))

const { apiRequest } = await import('./client.js')
const {
  fetchChildSummary,
  fetchGuardianPermissions,
  respondPermissionAsGuardian,
  fetchGuardianIncidents,
} = await import('./guardian.js')

beforeEach(() => {
  apiRequest.mockReset()
  apiRequest.mockResolvedValue({ ok: true })
})

describe('api/guardian', () => {
  it('pide el resumen del hijo con student_id', async () => {
    const signal = new AbortController().signal
    await fetchChildSummary(3, { signal })
    expect(apiRequest).toHaveBeenCalledWith('/me/summary?student_id=3', { signal })
  })

  it('lista permisos con los filtros activos', async () => {
    await fetchGuardianPermissions({ status: 'pending_guardian', student_id: 3 })
    expect(apiRequest).toHaveBeenLastCalledWith(
      '/permissions?status=pending_guardian&student_id=3',
      undefined,
    )

    await fetchGuardianPermissions({ status: '', student_id: '' })
    expect(apiRequest).toHaveBeenLastCalledWith('/permissions', undefined)
  })

  it('responde un permiso con PATCH y el body de decisión', async () => {
    await respondPermissionAsGuardian(11, 'approved')
    expect(apiRequest).toHaveBeenLastCalledWith('/permissions/11/guardian', {
      method: 'PATCH',
      body: { decision: 'approved' },
    })

    await respondPermissionAsGuardian(11, 'rejected')
    expect(apiRequest).toHaveBeenLastCalledWith('/permissions/11/guardian', {
      method: 'PATCH',
      body: { decision: 'rejected' },
    })
  })

  it('lista incidencias visibles para el apoderado', async () => {
    await fetchGuardianIncidents({ status: 'open', category: '', student_id: 3 }, { signal: 's' })
    expect(apiRequest).toHaveBeenLastCalledWith('/incidents?status=open&student_id=3', { signal: 's' })

    await fetchGuardianIncidents()
    expect(apiRequest).toHaveBeenLastCalledWith('/incidents', undefined)
  })
})
