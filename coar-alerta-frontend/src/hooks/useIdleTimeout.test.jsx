import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { touchActivity, useIdleTimeout } from './useIdleTimeout'

const LAST_ACTIVITY_KEY = 'coar.satre.last_activity'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  sessionStorage.clear()
})

const stored = () => Number(sessionStorage.getItem(LAST_ACTIVITY_KEY))

const renderIdle = (props = {}) =>
  renderHook((current) => useIdleTimeout(current), {
    initialProps: { enabled: true, timeoutMs: 1000, onIdle: vi.fn(), ...props },
  })

describe('touchActivity', () => {
  it('guarda la última actividad en sessionStorage', () => {
    touchActivity()

    expect(stored()).toBe(Date.now())
  })
})

describe('useIdleTimeout', () => {
  it('no hace nada si está deshabilitado', () => {
    const onIdle = vi.fn()
    renderIdle({ enabled: false, onIdle })

    act(() => {
      vi.advanceTimersByTime(60000)
    })

    expect(onIdle).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull()
  })

  it('inicializa la actividad si no existe y no dispara el timeout', () => {
    const onIdle = vi.fn()
    renderIdle({ onIdle })

    expect(stored()).toBe(Date.now())
    expect(onIdle).not.toHaveBeenCalled()
  })

  it('dispara onIdle al montar si la última actividad ya expiró', () => {
    sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now() - 5000))
    const onIdle = vi.fn()
    renderIdle({ timeoutMs: 1000, onIdle })

    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('dispara onIdle en el chequeo periódico una sola vez', () => {
    const onIdle = vi.fn()
    renderIdle({ timeoutMs: 1000, onIdle })

    act(() => {
      vi.advanceTimersByTime(15000)
    })
    expect(onIdle).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(30000)
    })
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('registra la actividad del usuario y aplica el throttle de escritura', () => {
    const onIdle = vi.fn()
    renderIdle({ timeoutMs: 60000, onIdle })
    const initial = stored()

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    act(() => {
      window.dispatchEvent(new Event('mousemove'))
    })
    expect(stored()).toBe(initial + 5000)

    const afterFirst = stored()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    act(() => {
      window.dispatchEvent(new Event('keydown'))
    })
    expect(stored()).toBe(afterFirst)

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(stored()).toBe(afterFirst + 6000)
    expect(onIdle).not.toHaveBeenCalled()
  })

  it('revisa la inactividad al volver a la pestaña', () => {
    const onIdle = vi.fn()
    renderIdle({ timeoutMs: 60000, onIdle })

    act(() => {
      vi.setSystemTime(new Date(Date.now() + 120000))
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('limpia el intervalo y los listeners al desmontarse', () => {
    const onIdle = vi.fn()
    const { unmount } = renderIdle({ timeoutMs: 1000, onIdle })

    act(() => {
      vi.advanceTimersByTime(15000)
    })
    expect(onIdle).toHaveBeenCalledTimes(1)

    unmount()

    act(() => {
      vi.advanceTimersByTime(60000)
    })
    act(() => {
      window.dispatchEvent(new Event('mousemove'))
    })
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('se activa al pasar de deshabilitado a habilitado', () => {
    const onIdle = vi.fn()
    const { rerender } = renderIdle({ enabled: false, timeoutMs: 60000, onIdle })
    expect(sessionStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull()

    rerender({ enabled: true, timeoutMs: 60000, onIdle })
    expect(stored()).toBe(Date.now())

    act(() => {
      vi.advanceTimersByTime(15000)
    })
    expect(onIdle).not.toHaveBeenCalled()
  })
})
