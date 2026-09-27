import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * `fn` recibe `{ signal }` para poder cancelar la petición si cambian las deps o se desmonta el componente.
 */
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [nonce, setNonce] = useState(0)
  const fnRef = useRef(fn)

  useEffect(() => {
    fnRef.current = fn
  })

  useEffect(() => {
    const controller = new AbortController()
    setState((current) => ({ ...current, loading: true, error: null }))

    Promise.resolve()
      .then(() => fnRef.current({ signal: controller.signal }))
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: null })
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.kind === 'aborted') return
        setState((current) => ({ data: current.data, loading: false, error }))
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { ...state, reload }
}

/**
 * `mutate` nunca lanza: devuelve `{ ok, data }` o `{ ok: false, error }`.
 * Los errores 422 quedan en `fieldErrors` ({ campo: 'mensaje' }) para pasarlos a `Field`.
 */
export function useMutation(fn, { onSuccess, onError } = {}) {
  const [state, setState] = useState({ data: null, loading: false, error: null })
  const callbacks = useRef({ fn, onSuccess, onError })

  useEffect(() => {
    callbacks.current = { fn, onSuccess, onError }
  })

  const mutate = useCallback(async (...args) => {
    setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const data = await callbacks.current.fn(...args)
      setState({ data, loading: false, error: null })
      callbacks.current.onSuccess?.(data)
      return { ok: true, data }
    } catch (error) {
      setState({ data: null, loading: false, error })
      callbacks.current.onError?.(error)
      return { ok: false, error }
    }
  }, [])

  const reset = useCallback(() => setState({ data: null, loading: false, error: null }), [])

  return { ...state, fieldErrors: state.error?.fieldErrors ?? {}, mutate, reset }
}
