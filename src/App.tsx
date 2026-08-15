import { useState } from 'react'
import { Shield } from 'lucide-react'
import { MasterEngine } from './components/engine/MasterEngine'
import { AccessGate } from './components/landing/AccessGate'
import { Header } from './components/landing/Header'
import { PortalCard } from './components/landing/PortalCard'
import { SSP_PORTAL } from './types/portal'

function App() {
  const [selected, setSelected] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  if (authenticated) {
    return (
      <MasterEngine
        onExit={() => {
          setAuthenticated(false)
          setSelected(false)
        }}
      />
    )
  }

  return (
    <div className="mesh-bg relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-overlay" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        <Header />

        <main className="flex flex-1 flex-col justify-center py-10 sm:py-14">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
              Spalter Tech
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-text-muted sm:text-lg">
              Enter the Sovereign Sign Protocol Master Engine to access multi-industry settlement
              infrastructure.
            </p>
          </div>

          <div role="group" aria-label="SSP gateway">
            <PortalCard
              id={SSP_PORTAL.id}
              title={SSP_PORTAL.title}
              subtitle={SSP_PORTAL.subtitle}
              icon={Shield}
              selected={selected}
              onSelect={() => setSelected(true)}
            />
          </div>

          {selected && (
            <AccessGate
              portal={SSP_PORTAL}
              onSuccess={() => setAuthenticated(true)}
            />
          )}
        </main>

        <footer className="pb-2 pt-4 text-center text-xs tracking-wide text-text-muted/70">
          Spalter Tech · SSP Encrypted gateway · Unauthorized access prohibited
        </footer>
      </div>
    </div>
  )
}

export default App
