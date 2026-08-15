import {
  Disc3,
  FileMusic,
  Layers,
  Library,
  ArrowLeft,
} from 'lucide-react'

interface CatalogVaultProps {
  onBackToGateway: () => void
}

const VAULT_SECTIONS = [
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
  {
    icon: Disc3,
    title: 'Archive Playback Hub',
    body: 'Secure audition lanes for approved stakeholders across archival and active titles.',
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
                Spalter Catalog & Audio Vault
              </p>
              <p className="mt-1 text-xs text-text-muted sm:text-sm">
                Master Recordings · Publishing Administration · Stem Systems
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToGateway}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-border-subtle bg-void-elevated/70 px-3 py-2 text-sm text-text-muted transition-colors hover:border-cyan-signal/35 hover:text-cyan-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-signal/60"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Portal Selection
          </button>
        </header>

        <section className="glass-panel glow-gold rounded-2xl p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold-signal">
            Vault Online
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            Authorized Catalog Operations
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base">
            Session authenticated. Manage masters, publishing splits, and stem systems from this
            vault console.
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
