import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components/Toast'
import { fetchMyRisk, fetchMySummary } from '../../api/student'
import {
  ALERT_STATUS,
  ATTENDANCE_FILTERS,
  ATTENDANCE_STATUS,
  CRITERIA,
  TUTOR_STATUS,
  alertText,
  formatRate,
  useMyRisk,
  useMySummary,
} from './shared'

vi.mock('../../api/student', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchMySummary: vi.fn(),
    fetchMyRisk: vi.fn(),
  }
})

const wrapper = ({ children }) => <ToastProvider>{children}</ToastProvider>

const summary = {
  data: {
    student: { id: 3, name: 'Valeria Chávez' },
    grades: { average: 15.5, literal: 'A' },
    courses: [{ id: 5, name: 'Matemáticas AA' }],
  },
}

describe('helpers de estudiante', () => {
  it('formatea la tasa de asistencia como porcentaje con un decimal', () => {
    expect(formatRate(null)).toBe('—')
    expect(formatRate(undefined)).toBe('—')
    expect(formatRate(0)).toBe('0%')
    expect(formatRate(1)).toBe('100%')
    expect(formatRate(0.856)).toBe('85.6%')
    expect(formatRate(0.8004)).toBe('80%')
  })

  it('usa el mensaje de la alerta y cae al título o al texto por defecto', () => {
    expect(alertText({ message: 'Faltas reiteradas', title: 'Alerta' })).toBe('Faltas reiteradas')
    expect(alertText({ title: 'Bajo rendimiento' })).toBe('Bajo rendimiento')
    expect(alertText(null)).toBe('Alerta')
    expect(alertText({})).toBe('Alerta')
  })

  it('expone los catálogos usados por las páginas del estudiante', () => {
    expect(CRITERIA).toEqual(['A', 'B', 'C', 'D'])
    expect(ALERT_STATUS).toMatchObject({
      open: { label: 'Abierta' },
      acknowledged: { label: 'En seguimiento' },
      resolved: { label: 'Resuelta' },
    })
    expect(ATTENDANCE_STATUS.present.label).toBe('Presente')
    expect(ATTENDANCE_STATUS.justified.label).toBe('Falta justificada')
    expect(ATTENDANCE_STATUS.absent.badge).toBe('absent')
    expect(ATTENDANCE_FILTERS.map((option) => option.value)).toEqual(['present', 'late', 'justified', 'absent'])
    expect(TUTOR_STATUS.completed.label).toBe('Completada')
  })
})

describe('useMySummary', () => {
  beforeEach(() => {
    fetchMySummary.mockReset()
    fetchMyRisk.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('desenvuelve data.data y expone el estado de carga', async () => {
    fetchMySummary.mockResolvedValue(summary)
    const { result } = renderHook(() => useMySummary(), { wrapper })

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.summary).toEqual(summary.data)
    expect(result.current.error).toBeNull()
    expect(fetchMySummary).toHaveBeenCalledWith({ signal: expect.anything() })
  })

  it('devuelve null y el error cuando falla la petición, y permite recargar', async () => {
    fetchMySummary.mockRejectedValueOnce({ status: 500, kind: 'http', message: 'Fallo' })
    fetchMySummary.mockResolvedValueOnce(summary)
    const { result } = renderHook(() => useMySummary(), { wrapper })

    await waitFor(() => expect(result.current.error).toMatchObject({ status: 500 }))
    expect(result.current.summary).toBeNull()

    result.current.reload()
    await waitFor(() => expect(result.current.summary).toEqual(summary.data))
    expect(fetchMySummary).toHaveBeenCalledTimes(2)
  })
})

describe('useMyRisk', () => {
  beforeEach(() => {
    fetchMySummary.mockReset()
    fetchMyRisk.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('no consulta el riesgo si todavía no hay estudiante', async () => {
    const { result } = renderHook(() => useMyRisk(undefined), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchMyRisk).not.toHaveBeenCalled()
    expect(result.current.available).toBe(false)
    expect(result.current.risk).toBeNull()
  })

  it('expone nivel y recomendación cuando la predicción está disponible', async () => {
    fetchMyRisk.mockResolvedValue({
      available: true,
      data: { student_id: 3, risk_level: 'ALTO', recommendation: 'Acompañamiento cercano.' },
    })
    const { result } = renderHook(() => useMyRisk(3), { wrapper })

    await waitFor(() => expect(result.current.risk).not.toBeNull())
    expect(fetchMyRisk).toHaveBeenCalledWith(3, { signal: expect.anything() })
    expect(result.current.available).toBe(true)
    expect(result.current.risk).toEqual({ student_id: 3, risk_level: 'ALTO', recommendation: 'Acompañamiento cercano.' })
  })

  it('trata available:false como ausencia de datos, no como error', async () => {
    fetchMyRisk.mockResolvedValue({ available: false, data: null })
    const { result } = renderHook(() => useMyRisk(3), { wrapper })

    await waitFor(() => expect(fetchMyRisk).toHaveBeenCalled())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.available).toBe(false)
    expect(result.current.risk).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('mantiene la carga activa mientras la respuesta llega como null', async () => {
    fetchMyRisk.mockResolvedValue(null)
    const { result } = renderHook(() => useMyRisk(3), { wrapper })

    await waitFor(() => expect(fetchMyRisk).toHaveBeenCalled())
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(true)
    expect(result.current.available).toBe(false)
    expect(result.current.risk).toBeNull()
  })

  it('propaga el error del endpoint de riesgo', async () => {
    fetchMyRisk.mockRejectedValue({ status: 404, kind: 'http', message: 'Sin datos' })
    const { result } = renderHook(() => useMyRisk(3), { wrapper })

    await waitFor(() => expect(result.current.error).toMatchObject({ status: 404 }))
    expect(result.current.risk).toBeNull()
  })
})
