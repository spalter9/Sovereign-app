import type { LucideIcon } from 'lucide-react'
import type { PortalId } from '../types/portal'

interface PortalCardProps {
  id: PortalId
  title: string
  subtitle: string
  icon: LucideIcon
  selected: boolean
  onSelect: (id: PortalId) => void
}

export function PortalCard({
  id,
  title,
  subtitle,
  icon: Icon,
  selected,
  onSelect,
}: PortalCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={selected}
      className={[
        'group relative w-full cursor-pointer rounded-2xl p-6 text-left transition-all duration-300',
        'glass-panel outline-none focus-visible:ring-2 focus-visible:ring-cyan-signal/60 focus-visible:ring-offset-2 focus-visible:ring-offset-void',
        selected
          ? 'glow-ring border-cyan-signal/50 scale-[1.01]'
          : 'hover:border-indigo-signal/40 hover:bg-slate-panel/70 hover:shadow-[0_0_28px_rgba(99,102,241,0.12)]',
      ].join(' ')}
    >
      <div
        className={[
          'mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border transition-colors duration-300',
          selected
            ? 'border-cyan-signal/40 bg-cyan-signal/10 text-cyan-signal'
            : 'border-border-subtle bg-void/60 text-text-muted group-hover:border-indigo-signal/35 group-hover:text-indigo-signal',
        ].join(' ')}
      >
        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </div>

      <h2 className="font-display text-lg font-semibold leading-snug tracking-tight text-text-primary sm:text-xl">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{subtitle}</p>

      <div
        className={[
          'mt-5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors duration-300',
          selected ? 'text-cyan-signal' : 'text-text-muted/80 group-hover:text-indigo-signal',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-1.5 w-1.5 rounded-full transition-all duration-300',
            selected
              ? 'bg-cyan-signal shadow-[0_0_8px_rgba(34,211,238,0.8)]'
              : 'bg-text-muted/50 group-hover:bg-indigo-signal',
          ].join(' ')}
          aria-hidden
        />
        {selected ? 'Selected' : 'Select Portal'}
      </div>
    </button>
  )
}
