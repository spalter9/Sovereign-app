export type PortalId = 'master' | 'surealizer'

/** Authenticated inner site. `null` = dual-portal gateway after lock unlock. */
export type SelectedView = null | 'master' | 'surealizer'

export interface PortalOption {
  id: PortalId
  title: string
  subtitle: string
  destination: string
}

export const PORTALS: PortalOption[] = [
  {
    id: 'master',
    title: 'SOVEREIGN SIGN PROTOCOL (SSP) MASTERING ENGINE',
    subtitle:
      'Multi-Industry Infrastructure, AI Data Licensing & Real-Time IRS Tax Terminal',
    destination: 'SSP Mastering Engine',
  },
  {
    id: 'surealizer',
    title: 'SUREALIZER ENGINE',
    subtitle:
      'Spalter Catalog & Audio Vault — Master Recordings, Publishing Administration & Stem Systems',
    destination: 'Surealizer Engine',
  },
]

export const VALID_ACCESS_CODES = ['SSP2026', 'SPALTER'] as const
