import { useEffect, useState } from 'react'
import { useToast } from '../../../components/Toast'
import { useApi, useMutation } from '../../../hooks/useApi'

const HANDLED_GLOBALLY = new Set(['network', 'timeout', 'aborted'])

/**
 * `api/client.js` ya muestra toasts para red, timeout, 401, 403 y 429; aquí solo el resto.
 * Con `form: true`, los 422 se muestran en cada `Field` y el toast solo avisa.
 */
export function notifyError(toast, error, { form = false } = {}) {
  if (!error || HANDLED_GLOBALLY.has(error.kind) || [401, 403, 429].includes(error.status)) return
  if (form && error.status === 422) toast.warning('Revisa los campos marcados.')
  else toast.error(error.message)
}

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function useLoadErrorToast(error) {
  const toast = useToast()
  useEffect(() => notifyError(toast, error), [toast, error])
}

export const toId = (value) => (value === '' || value === null || value === undefined ? null : Number(value))

/** Listado paginado de Laravel con filtros; los filtros de texto se envían con debounce. */
export function usePagedList(fetcher, initialFilters = {}) {
  const [filters, setFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const debouncedFilters = useDebounced(filters)
  const query = useApi(
    ({ signal }) => fetcher({ ...debouncedFilters, page }, { signal }),
    [JSON.stringify(debouncedFilters), page],
  )
  useLoadErrorToast(query.error)

  const setFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(1)
  }

  return { ...query, rows: query.data?.data ?? [], meta: query.data?.meta, filters, setFilter, setPage }
}

export function useFormState(initial) {
  const [form, setForm] = useState(initial)
  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }))
  const bind = (name) => ({ name, value: form[name] ?? '', onChange: (e) => set(name, e.target.value) })
  return { form, set, bind }
}

/** Estado del modal de alta/edición: `editing` es null (cerrado), `{}` (nuevo) o la fila a editar. */
export function useEditor(saveFn, { onSaved, created = 'Registro creado.', updated = 'Cambios guardados.' } = {}) {
  const toast = useToast()
  const [editing, setEditing] = useState(null)
  const mutation = useMutation(saveFn, { onError: (error) => notifyError(toast, error, { form: true }) })

  const open = (row = {}) => {
    mutation.reset()
    setEditing(row)
  }
  const close = () => setEditing(null)

  const submit = async (body) => {
    const id = editing?.id
    const result = await mutation.mutate(id, body)
    if (result.ok) {
      toast.success(id ? updated : created)
      close()
      onSaved?.(result.data, { created: !id })
    }
    return result
  }

  return { editing, open, close, submit, loading: mutation.loading, errors: mutation.fieldErrors }
}
