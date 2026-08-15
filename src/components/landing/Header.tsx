import { Activity } from 'lucide-react'

export function Header() {
  return (
    <header className="relative z-10 flex items-center justify-between gap-4 px-1 py-2">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-signal/30 bg-slate-panel/80 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
          aria-hidden
        >
          <span className="font-display text-sm font-bold tracking-tight text-cyan-signal">
            ST
          </span>
        </div>
        <div>
          <p className="font-display text-lg font-semibold tracking-tight text-text-primary sm:text-xl">
            Spalter Tech
          </p>
          <p className="text-xs tracking-wide text-text-muted">SSP Secure Access</p>
        </div>
      </div>

      <div
        className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300"
        role="status"
        aria-live="polite"
      >
        <Activity className="h-3.5 w-3.5 animate-pulse" aria-hidden />
        <span className="hidden sm:inline">System Online // v2.6</span>
        <span className="sm:hidden">Online // v2.6</span>
      </div>
    </header>
  )
}
