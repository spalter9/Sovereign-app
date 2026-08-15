export type PortalId = 'engine' | 'vault'

/** Authenticated inner site. `null` = dual-portal gateway (root default). */
export type SelectedView = null | 'engine' | 'vault'

export interface PortalOption {
  id: PortalId
  title: string
  subtitle: string
  destination: string
}

export const PORTALS: PortalOption[] = [
  {
    id: 'engine',
    title: 'SOVEREIGN SIGN PROTOCOL (SSP) MASTER ENGINE',
    subtitle:
      'Multi-Industry Infrastructure, AI Data Licensing & Real-Time IRS Tax Terminal',
    destination: 'SSP Master Engine',
  },
  {
    id: 'vault',
    title: 'SPALTER CATALOG & AUDIO VAULT',
    subtitle: 'Master Recordings, Publishing Administration & Stem Systems',
    destination: 'Spalter Catalog & Audio Vault',
  },
]

export const VALID_ACCESS_CODES = ['SSP2026', 'SPALTER'] as const
