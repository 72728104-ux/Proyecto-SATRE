import { useMediaQuery } from '../hooks/useMediaQuery'
import EmptyState from './EmptyState'
import { SkeletonList } from './Skeleton'

/**
 * Columnas: { key, header, render?, primary?, hideOnMobile?, mobileLabel? }.
 * En móvil cada fila se muestra como tarjeta: la columna `primary` (o la primera) es el título.
 * Solo se monta una de las dos vistas para no duplicar inputs dentro de las celdas.
 */
export default function DataTable({ columns, rows = [], empty = 'Sin registros para mostrar.', loading = false, keyField = 'id' }) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const cell = (col, row) => (col.render ? col.render(row) : row[col.key])

  if (loading) return <SkeletonList rows={5} />
  if (rows.length === 0) return typeof empty === 'string' ? <EmptyState title={empty} /> : empty

  if (!isDesktop) {
    const primary = columns.find((col) => col.primary) ?? columns[0]
    const details = columns.filter((col) => col !== primary && !col.hideOnMobile)

    return (
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row[keyField]} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="font-semibold text-navy-950">{cell(primary, row)}</div>
            {details.length ? (
              <dl className="mt-3 grid gap-3 text-sm min-[480px]:grid-cols-2">
                {details.map((col) => (
                  <div key={col.key} className="min-w-0">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {col.mobileLabel ?? col.header}
                    </dt>
                    <dd className="mt-0.5 text-slate-700">{cell(col, row)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 font-semibold">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[keyField]} className="border-t border-slate-100 hover:bg-slate-50/80">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-slate-700">
                    {cell(col, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
