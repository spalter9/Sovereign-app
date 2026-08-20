import { useState } from 'react'
import type { EngineModuleId } from '../../lib/mockData'
import { EngineHeader } from './EngineHeader'
import { LiveMetricsBar } from './LiveMetricsBar'
import { ModuleTabs } from './ModuleTabs'
import { AiLicensingModule } from './modules/AiLicensingModule'
import { FilmModule } from './modules/FilmModule'
import { GamingModule } from './modules/GamingModule'
import { MusicModule } from './modules/MusicModule'
import { TaxSettlementTerminal } from './modules/TaxSettlementTerminal'

interface MasterEngineProps {
  onExit: () => void
  onBackToConsole?: () => void
}

export function MasterEngine({ onExit, onBackToConsole }: MasterEngineProps) {
  const [activeModule, setActiveModule] = useState<EngineModuleId>('gaming')

  return (
    <div className="mesh-bg relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-overlay" aria-hidden />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <EngineHeader onExit={onExit} onBackToConsole={onBackToConsole} />
        <LiveMetricsBar />

        <div className="space-y-4">
          <ModuleTabs active={activeModule} onChange={setActiveModule} />

          <div
            role="tabpanel"
            id={`panel-${activeModule}`}
            aria-labelledby={`tab-${activeModule}`}
          >
            {activeModule === 'gaming' && <GamingModule />}
            {activeModule === 'film' && <FilmModule />}
            {activeModule === 'music' && <MusicModule />}
            {activeModule === 'ai' && <AiLicensingModule />}
            {activeModule === 'tax' && <TaxSettlementTerminal />}
          </div>
        </div>
      </div>
    </div>
  )
}
