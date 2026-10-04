import { Image } from 'lucide-react'

export default function VisualResourceCard({ resource }) {
  if (!resource?.title) return null

  return (
    <aside className="flex gap-3 rounded-xl border border-teal-100 bg-teal-50/70 px-3 py-2.5" data-cy="tutor-visual">
      <span className="mt-0.5 text-teal-700">
        <Image size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-navy-950">{resource.title}</p>
        {resource.description ? <p className="text-xs text-slate-600">{resource.description}</p> : null}
      </div>
    </aside>
  )
}
