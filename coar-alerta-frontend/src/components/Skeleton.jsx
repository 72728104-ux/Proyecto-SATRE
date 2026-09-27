export default function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} />
}

export function SkeletonList({ rows = 5 }) {
  return (
    <div role="status" className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Skeleton className="h-4 w-1/2 sm:w-1/3" />
          <Skeleton className="mt-3 h-3 w-5/6 sm:w-2/3" />
        </div>
      ))}
      <span className="sr-only">Cargando…</span>
    </div>
  )
}
