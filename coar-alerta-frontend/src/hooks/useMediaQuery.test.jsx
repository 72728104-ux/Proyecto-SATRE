import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

function stubMatchMedia(initialMatches) {
  const listeners = new Set()
  const media = {
    matches: initialMatches,
    media: '',
    onchange: null,
    addEventListener: vi.fn((event, listener) => listeners.add(listener)),
    removeEventListener: vi.fn((event, listener) => listeners.delete(listener)),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
  window.matchMedia = vi.fn(() => media)
  return { media, listeners }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useMediaQuery', () => {
  it('devuelve el valor inicial de matchMedia', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

    expect(result.current).toBe(true)
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 768px)')
  })

  it('devuelve false cuando la consulta no coincide', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

    expect(result.current).toBe(false)
  })

  it('se actualiza cuando matchMedia notifica un cambio', () => {
    const { media, listeners } = stubMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

    expect(result.current).toBe(false)

    act(() => {
      media.matches = true
      listeners.forEach((listener) => listener({ matches: true }))
    })

    expect(result.current).toBe(true)
  })

  it('se desuscribe al desmontarse', () => {
    const { media, listeners } = stubMatchMedia(true)
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'))

    expect(listeners.size).toBe(1)
    unmount()

    expect(media.removeEventListener).toHaveBeenCalledTimes(1)
    expect(listeners.size).toBe(0)
  })

  it('vuelve a suscribirse cuando cambia la consulta', () => {
    const { media } = stubMatchMedia(true)
    const { rerender } = renderHook(({ query }) => useMediaQuery(query), {
      initialProps: { query: '(min-width: 768px)' },
    })

    rerender({ query: '(min-width: 1024px)' })

    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1024px)')
    expect(media.removeEventListener).toHaveBeenCalled()
  })
})
