import {
  Disc3,
  FileMusic,
  Layers,
  Library,
  Lock,
  Sparkles,
} from 'lucide-react'

interface CatalogVaultProps {
  onBackToGateway: () => void
}

const VAULT_SECTIONS = [
  {
    icon: Sparkles,
    title: 'Surealizer Spatial Desk',
    body: 'Immersive spatial imaging, surreal atmosphere shaping, and release-ready audition lanes.',
  },
  {
    icon: Library,
    title: 'Master Recordings Registry',
    body: 'Immutable masters index with ISRC binding, version lineage, and release readiness status.',
  },
  {
    icon: FileMusic,
    title: 'Publishing Administration',
    body: 'Cue sheets, split notices, and territory licensing workflows for catalog administration.',
  },
  {
    icon: Layers,
    title: 'Stem Systems',
    body: 'Isolated stem vaults for mix recall, spatial delivery, and collaborator checkout.',
  },
] as const

export function CatalogVault({ onBackToGateway }: CatalogVaultProps) {
  return (
    <div className="mesh-bg relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-overlay" aria-hidden />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold-signal/35 bg-gold-signal/10 text-gold-signal"
              aria-hidden
            >
              <Disc3 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-text-primary sm:text-xl md:text-2xl">
                Surealizer Engine
              </p>
              <p className="mt-1 text-xs text-text-muted sm:text-sm">
                Spalter Catalog &amp; Audio Vault · Master Recordings · Stem Systems
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToGateway}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-red-400/45 bg-red-950/40 px-3 py-2 text-sm font-medium tracking-wide text-red-200 transition-colors hover:border-red-300/70 hover:bg-red-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
          >
            <Lock className="h-4 w-4" aria-hidden />
            Lock / Sign Out
          </button>
        </header>

        <section className="glass-panel glow-gold rounded-2xl p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold-signal">
            Surealizer Online
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            Authorized Catalog &amp; Spatial Operations
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base">
            Session authenticated. Run Surealizer spatial processing, manage masters,
            publishing splits, and stem systems from this vault console.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {VAULT_SECTIONS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="glass-panel rounded-2xl p-5 sm:p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-signal/25 bg-cyan-signal/10 text-cyan-signal">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h2 className="font-display text-lg font-semibold text-text-primary">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
