import { useState } from 'react'
import { MasterEngine } from './components/engine/MasterEngine'
import { PortalGateway } from './components/landing/PortalGateway'
import { CatalogVault } from './components/vault/CatalogVault'
import type { PortalId, SelectedView } from './types/portal'

/**
 * Root router for "/".
 * Default / refresh always lands on the Dual-Portal Gateway.
 * Inner sites mount only after passkey unlock sets `selectedView`.
 */
function App() {
  const [selectedPortalId, setSelectedPortalId] = useState<PortalId | null>(null)
  const [selectedView, setSelectedView] = useState<SelectedView>(null)

  const returnToGateway = () => {
    setSelectedView(null)
    setSelectedPortalId(null)
  }

  if (selectedView === 'engine') {
    return <MasterEngine onExit={returnToGateway} />
  }

  if (selectedView === 'vault') {
    return <CatalogVault onBackToGateway={returnToGateway} />
  }

  // Permanent opening screen — engine/vault are not mounted here.
  return (
    <PortalGateway
      selectedPortalId={selectedPortalId}
      onSelectPortal={setSelectedPortalId}
      onUnlock={(portalId) => setSelectedView(portalId)}
    />
  )
}

export default App
