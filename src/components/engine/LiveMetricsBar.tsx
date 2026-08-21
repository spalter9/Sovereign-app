import { Activity, Clock3, Landmark, Network } from 'lucide-react'
import { LIVE_METRICS, type LiveMetric } from '../../lib/mockData'

const ICONS = {
  volume: Activity,
  irs: Landmark,
  nodes: Network,
  latency: Clock3,
} as const

const ACCENT = {
  cyan: 'text-cyan-signal border-cyan-signal/25 bg-cyan-signal/8',
  gold: 'text-gold-signal border-gold-signal/25 bg-gold-signal/8',
  emerald: 'text-emerald-signal border-emerald-signal/25 bg-emerald-signal/8',
} as const

function MetricCard({ metric }: { metric: LiveMetric }) {
  const Icon = ICONS[metric.id as keyof typeof ICONS] ?? Activity
  return (
    <div className="glass-panel rounded-xl px-4 py-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${ACCENT[metric.accent]}`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
          {metric.label}
        </p>
      </div>
      <p className="font-display text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
        {metric.value}
      </p>
      {metric.hint && (
        <p className="mt-1 text-xs text-gold-signal/90">{metric.hint}</p>
      )}
    </div>
  )
}

export function LiveMetricsBar() {
  return (
    <section aria-label="Live protocol metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {LIVE_METRICS.map((metric) => (
        <MetricCard key={metric.id} metric={metric} />
      ))}
    </section>
  )
}
