import { FormEvent, useState } from 'react'
import { SspEngineConsole } from './components/console/SspEngineConsole'
import { MasterEngine } from './components/engine/MasterEngine'
import { CatalogVault } from './components/vault/CatalogVault'
import { SpaltyAssistant } from './components/SpaltyAssistant'
import './App.css'

type Stage = 'lock' | 'console' | 'master' | 'surealizer'

const VALID_PASSCODES = new Set(['SPALTER', 'SSP2026', '8888'])

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [stage, setStage] = useState<Stage>('lock')
  const [passcode, setPasscode] = useState('')
  const [hasError, setHasError] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)

  const handleUnlock = (event: FormEvent) => {
    event.preventDefault()
    const normalized = passcode.trim().toUpperCase()

    if (!VALID_PASSCODES.has(normalized)) {
      setHasError(true)
      return
    }

    setHasError(false)
    setIsUnlocking(true)

    window.setTimeout(() => {
      setIsAuthenticated(true)
      setStage('console')
      setIsUnlocking(false)
      setPasscode('')
    }, 420)
  }

  const handleLock = () => {
    setIsAuthenticated(false)
    setStage('lock')
    setPasscode('')
    setHasError(false)
    setIsUnlocking(false)
  }

  if (!isAuthenticated || stage === 'lock') {
    return (
      <div
        className={`stage stage--lock${isUnlocking ? ' stage--unlocking' : ''}${hasError ? ' stage--error' : ''}`}
      >
        <div className="lock-glow" aria-hidden="true" />
        <div className="lock-panel">
          <p className="lock-brand">SSPENGINE.COM</p>
          <p className="lock-status">Sovereign Sign Protocol // Restricted Console Access</p>

          <form className="lock-form" onSubmit={handleUnlock} noValidate>
            <label className="visually-hidden" htmlFor="passcode">
              Passcode
            </label>
            <input
              id="passcode"
              className={`lock-input${hasError ? ' lock-input--error' : ''}`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Enter Passcode"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value)
                if (hasError) setHasError(false)
              }}
              disabled={isUnlocking}
              aria-invalid={hasError}
              aria-describedby={hasError ? 'passcode-error' : undefined}
            />
            <button className="lock-submit" type="submit" disabled={isUnlocking}>
              Unlock Engine
            </button>
            {hasError ? (
              <p id="passcode-error" className="lock-error" role="alert">
                Invalid Access Code
              </p>
            ) : (
              <p className="lock-error lock-error--spacer" aria-hidden="true">
                &nbsp;
              </p>
            )}
          </form>
        </div>
      </div>
    )
  }

  if (stage === 'console') {
    return (
      <>
        <SspEngineConsole
          onLock={handleLock}
          onOpenMaster={() => setStage('master')}
          onOpenSurealizer={() => setStage('surealizer')}
        />
        <SpaltyAssistant />
      </>
    )
  }

  if (stage === 'master') {
    return (
      <>
        <MasterEngine
          onExit={handleLock}
          onBackToConsole={() => setStage('console')}
        />
        <SpaltyAssistant />
      </>
    )
  }

  return (
    <>
      <CatalogVault
        onBackToGateway={handleLock}
        onBackToConsole={() => setStage('console')}
      />
      <SpaltyAssistant />
    </>
  )
}

export default App
