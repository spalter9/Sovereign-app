import { ArrowLeft, Radio } from 'lucide-react'

interface EngineHeaderProps {
  onExit: () => void
}

export function EngineHeader({ onExit }: EngineHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-signal/35 bg-cyan-signal/10 shadow-[0_0_18px_rgba(0,240,255,0.18)]"
          aria-hidden
        >
          <span className="font-display text-sm font-bold text-cyan-signal">SSP</span>
        </div>
        <div>
          <p className="font-display text-lg font-semibold leading-snug tracking-tight text-text-primary sm:text-xl md:text-2xl">
            Spalter Tech{' '}
            <span className="text-text-muted">//</span>{' '}
            Sovereign Sign Protocol (SSP) Master Engine
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs text-text-muted sm:text-sm">
            <Radio className="h-3.5 w-3.5 text-emerald-signal" aria-hidden />
            Multi-Industry Settlement · Live Protocol Mesh
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onExit}
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-border-subtle bg-void-elevated/70 px-3 py-2 text-sm text-text-muted transition-colors hover:border-cyan-signal/35 hover:text-cyan-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-signal/60"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Portal Selection
      </button>
    </header>
  )
}
