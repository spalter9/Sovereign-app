export type PortalId = 'ssp'

export interface PortalOption {
  id: PortalId
  title: string
  subtitle: string
  destination: string
}

export const SSP_PORTAL: PortalOption = {
  id: 'ssp',
  title: 'Sovereign Sign Protocol (SSP) & Technology Gateway',
  subtitle: 'Protocol Infrastructure, Developer SDKs & Node Services',
  destination: 'SSP Master Engine',
}

export const VALID_ACCESS_CODES = ['SSP2026', 'SPALTER'] as const
