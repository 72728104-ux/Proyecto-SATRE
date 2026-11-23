import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useApi, useMutation } from './useApi'

afterEach(cleanup)

describe('useApi', () => {
  it('empieza cargando y expone los datos', async () => {
    const fn = vi.fn().mockResolvedValue({ total: 2 })
    const { result } = renderHook(() => useApi(fn, []))

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ total: 2 })
    expect(result.current.error).toBeNull()
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('expone el error y conserva los datos previos', async () => {
    const boom = new Error('falló')
    const fn = vi.fn().mockResolvedValueOnce({ ok: 1 }).mockRejectedValueOnce(boom)
    const { result } = renderHook(() => useApi(fn, []))

    await waitFor(() => expect(result.current.data).toEqual({ ok: 1 }))

    act(() => result.current.reload())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe(boom)
    expect(result.current.data).toEqual({ ok: 1 })
  })

  it('recarga con reload', async () => {
    const fn = vi.fn().mockResolvedValueOnce('primero').mockResolvedValueOnce('segundo')
    const { result } = renderHook(() => useApi(fn, []))

    await waitFor(() => expect(result.current.data).toBe('primero'))

    act(() => result.current.reload())
    await waitFor(() => expect(result.current.data).toBe('segundo'))
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('vuelve a consultar cuando cambian las dependencias', async () => {
    const fn = vi.fn(({ signal }) => Promise.resolve(signal ? 'con signal' : 'sin signal'))
    const { result, rerender } = renderHook(({ id }) => useApi(() => Promise.resolve(`id-${id}`), [id]), {
      initialProps: { id: 1 },
    })

    await waitFor(() => expect(result.current.data).toBe('id-1'))

    rerender({ id: 2 })
    await waitFor(() => expect(result.current.data).toBe('id-2'))
  })

  it('ignora los errores de tipo aborted', async () => {
    const fn = vi.fn().mockRejectedValue({ kind: 'aborted' })
    const { result } = renderHook(() => useApi(fn, []))

    await waitFor(() => expect(fn).toHaveBeenCalled())
    await act(async () => {})

    expect(result.current.error).toBeNull()
    expect(result.current.data).toBeNull()
  })

  it('aborta la petición al desmontarse y descarta la respuesta tardía', async () => {
    let capturedSignal
    let resolveRequest
    const fn = vi.fn(({ signal }) => {
      capturedSignal = signal
      return new Promise((resolve) => {
        resolveRequest = resolve
      })
    })
    const { result, unmount } = renderHook(() => useApi(fn, []))

    await waitFor(() => expect(fn).toHaveBeenCalled())
    unmount()
    expect(capturedSignal.aborted).toBe(true)

    await act(async () => {
      resolveRequest('tarde')
      await Promise.resolve()
    })

    expect(result.current.data).toBeNull()
  })
})

describe('useMutation', () => {
  it('ejecuta la mutación, guarda los datos y llama onSuccess', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 9 })
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useMutation(fn, { onSuccess }))

    let outcome
    await act(async () => {
      outcome = await result.current.mutate('dato')
    })

    expect(outcome).toEqual({ ok: true, data: { id: 9 } })
    expect(fn).toHaveBeenCalledWith('dato')
    expect(result.current.data).toEqual({ id: 9 })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.fieldErrors).toEqual({})
    expect(onSuccess).toHaveBeenCalledWith({ id: 9 })
  })

  it('nunca lanza: devuelve ok false, guarda fieldErrors y llama onError', async () => {
    const error = { message: 'Datos inválidos.', fieldErrors: { email: 'El correo no es válido.' } }
    const fn = vi.fn().mockRejectedValue(error)
    const onError = vi.fn()
    const { result } = renderHook(() => useMutation(fn, { onError }))

    let outcome
    await act(async () => {
      outcome = await result.current.mutate()
    })

    expect(outcome).toEqual({ ok: false, error })
    expect(result.current.error).toBe(error)
    expect(result.current.fieldErrors).toEqual({ email: 'El correo no es válido.' })
    expect(onError).toHaveBeenCalledWith(error)
    expect(result.current.data).toBeNull()
  })

  it('expone el estado de carga mientras espera', async () => {
    let resolveMutation
    const fn = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveMutation = resolve
        }),
    )
    const { result } = renderHook(() => useMutation(fn))

    let promise
    act(() => {
      promise = result.current.mutate()
    })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveMutation('listo')
      await promise
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBe('listo')
  })

  it('permite resetear el estado', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useMutation(fn))

    await act(async () => {
      await result.current.mutate()
    })
    expect(result.current.data).toEqual({ ok: true })

    act(() => result.current.reset())
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.fieldErrors).toEqual({})
  })

  it('devuelve fieldErrors vacío cuando el error no trae el bloque', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('red'))
    const { result } = renderHook(() => useMutation(fn))

    await act(async () => {
      await result.current.mutate()
    })

    expect(result.current.fieldErrors).toEqual({})
  })
})
