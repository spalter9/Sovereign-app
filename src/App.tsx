import { useState } from 'react'
import { AudioLines, Shield } from 'lucide-react'
import { MasterEngine } from './components/engine/MasterEngine'
import { AccessGate } from './components/landing/AccessGate'
import { CatalogDashboard } from './components/landing/CatalogDashboard'
import { Header } from './components/landing/Header'
import { PortalCard } from './components/landing/PortalCard'
import { PORTALS, type PortalId } from './types/portal'

const PORTAL_ICONS = {
  ssp: Shield,
  catalog: AudioLines,
} as const

function App() {
  const [selectedId, setSelectedId] = useState<PortalId | null>(null)
  const [authenticatedPortal, setAuthenticatedPortal] = useState<PortalId | null>(null)

  const selectedPortal = PORTALS.find((p) => p.id === selectedId) ?? null
  const activePortal = PORTALS.find((p) => p.id === authenticatedPortal) ?? null

  if (activePortal?.id === 'ssp') {
    return (
      <MasterEngine
        onExit={() => {
          setAuthenticatedPortal(null)
          setSelectedId(null)
        }}
      />
    )
  }

  if (activePortal) {
    return (
      <CatalogDashboard
        portal={activePortal}
        onExit={() => {
          setAuthenticatedPortal(null)
          setSelectedId(null)
        }}
      />
    )
  }

  return (
    <div className="mesh-bg relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-overlay" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        <Header />

        <main className="flex flex-1 flex-col justify-center py-10 sm:py-14">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
              Spalter Tech
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-text-muted sm:text-lg">
              Select a secure portal to continue into protocol infrastructure or catalog systems.
            </p>
          </div>

          <div
            className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5"
            role="group"
            aria-label="Portal selector"
          >
            {PORTALS.map((portal) => (
              <PortalCard
                key={portal.id}
                id={portal.id}
                title={portal.title}
                subtitle={portal.subtitle}
                icon={PORTAL_ICONS[portal.id]}
                selected={selectedId === portal.id}
                onSelect={setSelectedId}
              />
            ))}
          </div>

          {selectedPortal && (
            <AccessGate
              key={selectedPortal.id}
              portal={selectedPortal}
              onSuccess={setAuthenticatedPortal}
            />
          )}
        </main>

        <footer className="pb-2 pt-4 text-center text-xs tracking-wide text-text-muted/70">
          Spalter Tech · Encrypted gateway · Unauthorized access prohibited
        </footer>
      </div>
    </div>
  )
}

export default App
