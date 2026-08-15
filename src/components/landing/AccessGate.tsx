import { useId, useState, type FormEvent } from 'react'
import { AlertCircle, KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { VALID_ACCESS_CODES, type PortalId, type PortalOption } from '../../types/portal'

interface AccessGateProps {
  portal: PortalOption
  onSuccess: (portalId: PortalId) => void
}

export function AccessGate({ portal, onSuccess }: AccessGateProps) {
  const inputId = useId()
  const errorId = useId()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const trimmed = code.trim().toUpperCase()
    if (!trimmed) {
      setError('Access Code Invalid. Please check your credentials.')
      return
    }

    setLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 900))

    const isValid = VALID_ACCESS_CODES.some(
      (valid) => valid.toUpperCase() === trimmed,
    )

    if (!isValid) {
      setLoading(false)
      setError('Access Code Invalid. Please check your credentials.')
      return
    }

    setSuccess(true)
    setLoading(false)
    await new Promise((resolve) => setTimeout(resolve, 700))
    onSuccess(portal.id)
  }

  return (
    <section
      className={[
        'glass-panel mt-8 overflow-hidden rounded-2xl p-6 transition-all duration-500',
        success ? 'glow-ring border-cyan-signal/40' : '',
      ].join(' ')}
      aria-labelledby={`${inputId}-heading`}
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-signal/25 bg-cyan-signal/10 text-cyan-signal">
          <KeyRound className="h-[18px] w-[18px]" aria-hidden />
        </div>
        <div>
          <h3
            id={`${inputId}-heading`}
            className="font-display text-base font-semibold tracking-tight text-text-primary"
          >
            Enter Security Access Code / Passkey
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Authenticate to enter{' '}
            <span className="text-text-primary/90">{portal.destination}</span>
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor={inputId} className="sr-only">
            Security Access Code / Passkey
          </label>
          <input
            id={inputId}
            type="text"
            name="accessCode"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            value={code}
            disabled={loading || success}
            onChange={(e) => {
              setCode(e.target.value)
              if (error) setError(null)
            }}
            placeholder="Enter access code"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={[
              'w-full rounded-xl border bg-void/70 px-4 py-3.5 font-display text-base tracking-[0.18em] text-text-primary placeholder:tracking-normal placeholder:text-text-muted/50',
              'outline-none transition-all duration-200',
              'focus:border-cyan-signal/50 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.15)]',
              error
                ? 'border-rose-400/50 focus:border-rose-400/60 focus:shadow-[0_0_0_3px_rgba(251,113,133,0.15)]'
                : 'border-border-subtle',
            ].join(' ')}
          />
        </div>

        {error && (
          <div
            id={errorId}
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-200 transition-all duration-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-200"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
            <span>Access granted. Opening gateway…</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || success}
          className={[
            'inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-display text-sm font-semibold tracking-wide',
            'bg-gradient-to-r from-cyan-signal to-indigo-signal text-void',
            'transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_28px_rgba(34,211,238,0.25)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void',
            'disabled:cursor-not-allowed disabled:opacity-70',
          ].join(' ')}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Verifying…
            </>
          ) : success ? (
            <>
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Access Granted
            </>
          ) : (
            'Verify & Enter'
          )}
        </button>
      </form>
    </section>
  )
}
