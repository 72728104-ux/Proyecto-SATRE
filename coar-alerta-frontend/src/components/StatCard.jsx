export default function StatCard({ icon: Icon, label, value, hint, tone = 'navy' }) {
  const tones = {
    navy: 'from-navy-800 to-navy-950 text-white',
    rose: 'from-rose-600 to-rose-800 text-white',
    amber: 'from-amber-500 to-orange-600 text-white',
    teal: 'from-teal-600 to-emerald-700 text-white',
    slate: 'from-slate-100 to-white text-navy-950 border border-slate-200',
  }

  return (
    <article className={`rounded-2xl bg-gradient-to-br p-5 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm ${tone === 'slate' ? 'text-slate-500' : 'text-white/80'}`}>{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        {Icon ? (
          <span className={`rounded-xl p-2 ${tone === 'slate' ? 'bg-navy-50 text-navy-800' : 'bg-white/15'}`}>
            <Icon size={20} />
          </span>
        ) : null}
      </div>
      {hint ? <p className={`mt-3 text-xs ${tone === 'slate' ? 'text-slate-500' : 'text-white/75'}`}>{hint}</p> : null}
    </article>
  )
}
