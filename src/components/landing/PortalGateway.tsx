import { AudioLines, Shield } from 'lucide-react'
import { AccessGate } from './AccessGate'
import { Header } from './Header'
import { PortalCard } from './PortalCard'
import { PORTALS, type PortalId } from '../../types/portal'

const PORTAL_ICONS = {
  engine: Shield,
  vault: AudioLines,
} as const

interface PortalGatewayProps {
  selectedPortalId: PortalId | null
  onSelectPortal: (id: PortalId) => void
  onUnlock: (id: PortalId) => void
}

/**
 * Permanent opening screen for "/".
 * Never mounts Master Engine or Catalog Vault — only dual-door selection + passkey.
 */
export function PortalGateway({
  selectedPortalId,
  onSelectPortal,
  onUnlock,
}: PortalGatewayProps) {
  const selectedPortal =
    PORTALS.find((portal) => portal.id === selectedPortalId) ?? null

  return (
    <div className="mesh-bg relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-overlay" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        <Header />

        <main className="flex flex-1 flex-col justify-center py-10 sm:py-14">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl md:text-[2.75rem]">
              SPALTER ENTERTAINMENT TECHNOLOGIES
            </h1>
            <p className="mx-auto mt-4 text-base tracking-wide text-text-muted sm:text-lg">
              Select Authorized Entry Gateway
            </p>
          </div>

          <div
            className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5"
            role="group"
            aria-label="Two-door portal gateway"
          >
            {PORTALS.map((portal) => (
              <PortalCard
                key={portal.id}
                id={portal.id}
                title={portal.title}
                subtitle={portal.subtitle}
                icon={PORTAL_ICONS[portal.id]}
                selected={selectedPortalId === portal.id}
                onSelect={onSelectPortal}
              />
            ))}
          </div>

          {selectedPortal && (
            <AccessGate
              key={selectedPortal.id}
              portal={selectedPortal}
              onSuccess={onUnlock}
            />
          )}
        </main>

        <footer className="pb-2 pt-4 text-center text-xs tracking-wide text-text-muted/70">
          Spalter Entertainment Technologies · Dual-Portal Gateway · Authorized access only
        </footer>
      </div>
    </div>
  )
}
