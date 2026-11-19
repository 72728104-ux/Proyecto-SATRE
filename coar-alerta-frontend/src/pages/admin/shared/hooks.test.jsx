import { act, cleanup, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../components/Toast'
import {
  notifyError,
  toId,
  useDebounced,
  useEditor,
  useFormState,
  useLoadErrorToast,
  usePagedList,
} from './hooks'

const wrapper = ({ children }) => <ToastProvider>{children}</ToastProvider>

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('notifyError', () => {
  const toast = () => ({ error: vi.fn(), warning: vi.fn() })

  it('ignora errores nulos, de red y estados que el cliente ya notifica', () => {
    const api = toast()
    notifyError(api, null)
    notifyError(api, { kind: 'network' })
    notifyError(api, { kind: 'timeout' })
    notifyError(api, { kind: 'aborted' })
    notifyError(api, { status: 401 })
    notifyError(api, { status: 403 })
    notifyError(api, { status: 429 })
    expect(api.error).not.toHaveBeenCalled()
    expect(api.warning).not.toHaveBeenCalled()
  })

  it('usa warning para 422 de formulario y error para el resto', () => {
    const api = toast()
    notifyError(api, { status: 422, message: 'Datos inválidos' }, { form: true })
    expect(api.warning).toHaveBeenCalledWith('Revisa los campos marcados.')
    expect(api.error).not.toHaveBeenCalled()

    notifyError(api, { status: 422, message: 'Datos inválidos' })
    expect(api.error).toHaveBeenCalledWith('Datos inválidos')

    notifyError(api, { status: 500, message: 'Falla interna' })
    expect(api.error).toHaveBeenLastCalledWith('Falla interna')
  })
})

describe('toId', () => {
  it('convierte selects a número y deja null los vacíos', () => {
    expect(toId('')).toBeNull()
    expect(toId(null)).toBeNull()
    expect(toId(undefined)).toBeNull()
    expect(toId('7')).toBe(7)
    expect(toId(7)).toBe(7)
  })
})

describe('useDebounced', () => {
  it('retrasa el valor hasta cumplir el plazo y reinicia el temporizador', async () => {
    vi.useFakeTimers()
    const { result, rerender, unmount } = renderHook(({ value }) => useDebounced(value, 200), {
      initialProps: { value: 'a' },
    })

    expect(result.current).toBe('a')

    rerender({ value: 'b' })
    await act(() => vi.advanceTimersByTime(150))
    rerender({ value: 'c' })
    await act(() => vi.advanceTimersByTime(199))
    expect(result.current).toBe('a')

    await act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('c')

    unmount()
  })

  it('usa 300 ms por defecto', async () => {
    vi.useFakeTimers()
    const { result, rerender, unmount } = renderHook(({ value }) => useDebounced(value), {
      initialProps: { value: 'inicial' },
    })
    rerender({ value: 'final' })
    await act(() => vi.advanceTimersByTime(299))
    expect(result.current).toBe('inicial')
    await act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('final')
    unmount()
  })
})

describe('useLoadErrorToast', () => {
  it('publica el mensaje del error como toast', async () => {
    renderHook(() => useLoadErrorToast({ kind: 'server', status: 500, message: 'No se pudo cargar' }), {
      wrapper,
    })

    await waitFor(() => expect(screen.getByText('No se pudo cargar')).toBeTruthy())
  })

  it('no publica nada sin error', async () => {
    const { result } = renderHook(() => useLoadErrorToast(null), { wrapper })
    await waitFor(() => expect(result.current).toBeUndefined())
    expect(screen.queryByText(/No se pudo cargar/)).toBeNull()
  })
})

describe('useFormState', () => {
  it('actualiza campos y genera bindings para los Field', () => {
    const { result } = renderHook(() => useFormState({ name: 'Ana', role: 'teacher' }))

    act(() => result.current.set('name', 'Luis'))
    expect(result.current.form).toEqual({ name: 'Luis', role: 'teacher' })

    const bind = result.current.bind('name')
    expect(bind.name).toBe('name')
    expect(bind.value).toBe('Luis')
    act(() => bind.onChange({ target: { value: 'Eva' } }))
    expect(result.current.form.name).toBe('Eva')

    expect(result.current.bind('missing').value).toBe('')
  })
})

describe('usePagedList', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('carga la primera página, filtra y pagina contra el backend', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      data: [{ id: 1, name: 'Ana' }],
      meta: { current_page: 1, last_page: 2, total: 20 },
    })

    const { result } = renderHook(() => usePagedList(fetcher, { search: '' }), { wrapper })

    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    expect(result.current.meta.last_page).toBe(2)
    expect(fetcher).toHaveBeenCalledWith(
      { search: '', page: 1 },
      expect.objectContaining({ signal: expect.anything() }),
    )

    act(() => result.current.setPage(2))
    await waitFor(() =>
      expect(fetcher).toHaveBeenLastCalledWith(
        { search: '', page: 2 },
        expect.objectContaining({ signal: expect.anything() }),
      ),
    )

    act(() => result.current.setFilter('search', 'ana'))
    expect(result.current.filters.search).toBe('ana')
    await waitFor(() =>
      expect(fetcher).toHaveBeenLastCalledWith(
        { search: 'ana', page: 1 },
        expect.objectContaining({ signal: expect.anything() }),
      ),
    )
  })

  it('expone el error de carga y permite reintentar', async () => {
    const error = { kind: 'server', status: 500, message: 'No se pudo listar' }
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1 } })

    const { result } = renderHook(() => usePagedList(fetcher), { wrapper })

    await waitFor(() => expect(result.current.error).toEqual(error))
    expect(result.current.rows).toEqual([])
    await waitFor(() => expect(screen.getByText('No se pudo listar')).toBeTruthy())

    act(() => result.current.reload())
    await waitFor(() => expect(result.current.error).toBeNull())
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

describe('useEditor', () => {
  it('abre en modo creación, guarda, muestra toast y avisa del alta', async () => {
    const saveFn = vi.fn().mockResolvedValue({ data: { id: 9 } })
    const onSaved = vi.fn()

    const { result } = renderHook(() => useEditor(saveFn, { created: 'Aula creada.', onSaved }), {
      wrapper,
    })

    expect(result.current.editing).toBeNull()

    act(() => result.current.open())
    expect(result.current.editing).toEqual({})

    let response
    await act(async () => {
      response = await result.current.submit({ name: '5to A' })
    })

    expect(response.ok).toBe(true)
    expect(saveFn).toHaveBeenCalledWith(undefined, { name: '5to A' })
    expect(onSaved).toHaveBeenCalledWith({ data: { id: 9 } }, { created: true })
    expect(result.current.editing).toBeNull()
    expect(screen.getByText('Aula creada.')).toBeTruthy()
  })

  it('edita una fila existente y avisa la actualización', async () => {
    const saveFn = vi.fn().mockResolvedValue({ data: { id: 4 } })
    const { result } = renderHook(() => useEditor(saveFn, { updated: 'Cambios guardados.' }), { wrapper })

    act(() => result.current.open({ id: 4, name: '5to A' }))
    expect(result.current.editing).toEqual({ id: 4, name: '5to A' })

    await act(async () => {
      await result.current.submit({ name: '5to A bis' })
    })

    expect(saveFn).toHaveBeenCalledWith(4, { name: '5to A bis' })
    expect(screen.getByText('Cambios guardados.')).toBeTruthy()
  })

  it('mantiene el modal abierto y expone los errores de campo en un 422', async () => {
    const saveFn = vi.fn().mockRejectedValue({
      status: 422,
      message: 'Datos inválidos',
      fieldErrors: { name: ['El nombre es obligatorio.'] },
    })
    const { result } = renderHook(() => useEditor(saveFn), { wrapper })

    act(() => result.current.open())
    let response
    await act(async () => {
      response = await result.current.submit({})
    })

    expect(response.ok).toBe(false)
    expect(result.current.editing).toEqual({})
    await waitFor(() => expect(result.current.errors).toEqual({ name: ['El nombre es obligatorio.'] }))
    expect(screen.getByText('Revisa los campos marcados.')).toBeTruthy()
  })

  it('permite cerrar el modal y reiniciar los errores', async () => {
    const saveFn = vi.fn().mockRejectedValue({ status: 500, message: 'Falla' })
    const { result } = renderHook(() => useEditor(saveFn), { wrapper })

    act(() => result.current.open({ id: 2 }))
    await act(async () => {
      await result.current.submit({})
    })
    expect(screen.getByText('Falla')).toBeTruthy()

    act(() => result.current.close())
    expect(result.current.editing).toBeNull()
    expect(result.current.errors).toEqual({})

    act(() => result.current.open())
    expect(result.current.errors).toEqual({})
  })
})
