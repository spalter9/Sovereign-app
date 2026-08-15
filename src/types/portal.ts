export type PortalId = 'ssp' | 'catalog'

export interface PortalOption {
  id: PortalId
  title: string
  subtitle: string
  destination: string
}

export const PORTALS: PortalOption[] = [
  {
    id: 'ssp',
    title: 'Sovereign Sign Protocol (SSP) & Technology Gateway',
    subtitle: 'Protocol Infrastructure, Developer SDKs & Node Services',
    destination: 'SSP Technology Gateway',
  },
  {
    id: 'catalog',
    title: 'Spalter Catalog & Audio Systems',
    subtitle: 'Production Archives, Masters Registry & Publishing Hub',
    destination: 'Spalter Catalog Hub',
  },
]

export const VALID_ACCESS_CODES = ['SSP2026', 'SPALTER'] as const
