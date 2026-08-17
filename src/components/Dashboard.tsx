import { ArrowLeft, LayoutDashboard } from 'lucide-react'
import type { PortalOption } from '../types/portal'

interface DashboardProps {
  portal: PortalOption
  onExit: () => void
}

export function Dashboard({ portal, onExit }: DashboardProps) {
  return (
    <div className="mesh-bg relative flex min-h-screen flex-col">
      <div className="pointer-events-none absolute inset-0 grid-overlay" aria-hidden />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
        <button
          type="button"
          onClick={onExit}
          className="mb-10 inline-flex w-fit items-center gap-2 rounded-lg border border-border-subtle bg-void-elevated/60 px-3 py-2 text-sm text-text-muted transition-colors hover:border-cyan-signal/30 hover:text-cyan-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-signal/60"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Return to portal selector
        </button>

        <div className="glass-panel glow-ring flex flex-1 flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-signal/35 bg-cyan-signal/10 text-cyan-signal">
            <LayoutDashboard className="h-7 w-7" aria-hidden />
          </div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-cyan-signal">
            Dashboard Online
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            {portal.destination}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-text-muted">
            Session authenticated. Simulated routing complete for the{' '}
            <span className="text-text-primary/85">{portal.title}</span> portal.
          </p>
        </div>
      </div>
    </div>
  )
}
