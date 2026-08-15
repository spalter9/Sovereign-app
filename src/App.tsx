import { FormEvent, useState } from 'react'
import './App.css'

type Stage = 'lock' | 'portals' | 'ssp' | 'catalog'

const VALID_PASSCODES = new Set(['SPALTER', 'SSP2026'])

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
      setStage('portals')
      setIsUnlocking(false)
      setPasscode('')
    }, 520)
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
          <p className="lock-brand">SPALTER ENTERTAINMENT TECHNOLOGIES</p>
          <p className="lock-status">System Online // Restricted Executive Access</p>

          <form className="lock-form" onSubmit={handleUnlock} noValidate>
            <label className="visually-hidden" htmlFor="passcode">
              Passcode
            </label>
            <input
              id="passcode"
              className={`lock-input${hasError ? ' lock-input--error' : ''}`}
              type="password"
              autoComplete="current-password"
              placeholder="Enter Passcode (e.g. SPALTER)"
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
              Unlock Gateway
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

  if (stage === 'portals') {
    return (
      <div className="stage stage--portals">
        <div className="portals-glow" aria-hidden="true" />
        <header className="portals-header">
          <p className="portals-kicker">Spalter Entertainment Technologies</p>
          <h1 className="portals-title">Select Authorized Gateway</h1>
        </header>

        <div className="portal-grid">
          <button
            type="button"
            className="portal-card"
            onClick={() => setStage('ssp')}
          >
            <span className="portal-card__label">Gateway 01</span>
            <span className="portal-card__title">
              SOVEREIGN SIGN PROTOCOL (SSP) MASTER ENGINE
            </span>
            <span className="portal-card__desc">
              Multi-Industry Infrastructure, AI Data Licensing &amp; Real-Time IRS
              Tax Terminal
            </span>
          </button>

          <button
            type="button"
            className="portal-card"
            onClick={() => setStage('catalog')}
          >
            <span className="portal-card__label">Gateway 02</span>
            <span className="portal-card__title">
              SPALTER CATALOG &amp; AUDIO VAULT
            </span>
            <span className="portal-card__desc">
              Master Recordings, Publishing Administration &amp; Stem Systems
            </span>
          </button>
        </div>
      </div>
    )
  }

  const isSsp = stage === 'ssp'

  return (
    <div className={`stage stage--destination stage--${stage}`}>
      <header className="dest-header">
        <div className="dest-header__brand">
          <p className="dest-header__eyebrow">Spalter Entertainment Technologies</p>
          <h1 className="dest-header__title">
            {isSsp
              ? 'SOVEREIGN SIGN PROTOCOL (SSP) MASTER ENGINE'
              : 'SPALTER CATALOG & AUDIO VAULT'}
          </h1>
        </div>
        <button type="button" className="dest-lock" onClick={handleLock}>
          Lock / Sign Out
        </button>
      </header>

      <main className="dest-body">
        <p className="dest-lead">
          {isSsp
            ? 'Multi-Industry Infrastructure, AI Data Licensing & Real-Time IRS Tax Terminal.'
            : 'Master Recordings, Publishing Administration & Stem Systems.'}
        </p>
        <p className="dest-note">
          Authorized session active. Use Lock / Sign Out to return to the security
          gate.
        </p>
      </main>
    </div>
  )
}

export default App
