const STYLES = {
  critico: 'bg-rose-100 text-rose-800 ring-rose-200',
  alto: 'bg-orange-100 text-orange-800 ring-orange-200',
  medio: 'bg-amber-100 text-amber-900 ring-amber-200',
  normal: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  pendiente_apoderado: 'bg-sky-100 text-sky-800 ring-sky-200',
  pendiente_residencia: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  autorizado: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  observado: 'bg-amber-100 text-amber-900 ring-amber-200',
  presente: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  present: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  falta: 'bg-rose-100 text-rose-800 ring-rose-200',
  absent: 'bg-rose-100 text-rose-800 ring-rose-200',
  tardanza: 'bg-amber-100 text-amber-900 ring-amber-200',
  late: 'bg-amber-100 text-amber-900 ring-amber-200',
  justified: 'bg-sky-100 text-sky-800 ring-sky-200',
  ausente: 'bg-rose-100 text-rose-800 ring-rose-200',
  permiso: 'bg-sky-100 text-sky-800 ring-sky-200',
}

const LABELS = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Medio',
  normal: 'Normal',
  pendiente_apoderado: 'Pendiente apoderado',
  pendiente_residencia: 'Pendiente residencia',
  autorizado: 'Autorizado',
  observado: 'Observado',
  presente: 'Presente',
  present: 'Presente',
  falta: 'Falta',
  absent: 'Falta',
  tardanza: 'Tardanza',
  late: 'Tardanza',
  justified: 'Justificado',
  ausente: 'Ausente',
  permiso: 'Con permiso',
}

export default function AlertBadge({ nivel, children }) {
  const key = nivel || 'normal'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STYLES[key] ?? STYLES.normal}`}
    >
      {children ?? LABELS[key] ?? key}
    </span>
  )
}
