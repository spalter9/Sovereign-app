import { useMemo, useState } from 'react'
import { FileAudio, Link2, Upload } from 'lucide-react'
import { formatUsd, mockAssetHash, truncateHash } from '../../../lib/format'
import { FILM_SPLIT } from '../../../lib/mockData'
import { SectionCard } from '../SectionCard'

export function FilmModule() {
  const [gross, setGross] = useState(2_500_000)
  const [fingerprint, setFingerprint] = useState('cue://orchestra-night-scene-04')
  const [verified, setVerified] = useState(false)

  const distributions = useMemo(
    () =>
      FILM_SPLIT.map((row) => ({
        ...row,
        amount: gross * row.pct,
      })),
    [gross],
  )

  const chainHash = useMemo(
    () => mockAssetHash(`cue|${fingerprint}|${gross}`),
    [fingerprint, gross],
  )

  return (
    <div className="tab-panel-enter grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SectionCard
        title="Sync Licensing & Cue-Sheet Router"
        subtitle="Box office / streaming gross distributed across talent and treasuries."
        glow
      >
        <label className="block text-sm text-text-muted">
          Production gross (USD)
          <input
            type="number"
            min={0}
            step={1000}
            value={gross}
            onChange={(e) => setGross(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1.5 w-full rounded-xl border border-border-subtle bg-void/70 px-3.5 py-2.5 font-display text-lg text-text-primary outline-none transition focus:border-cyan-signal/45"
          />
        </label>

        <ul className="mt-5 space-y-2.5">
          {distributions.map((row) => (
            <li key={row.role} className="rounded-xl border border-border-subtle bg-void/35 px-3.5 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm text-text-primary">{row.role}</span>
                <span className="font-display text-sm font-semibold text-text-primary">
                  {formatUsd(row.amount, 0)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-void-elevated">
                <div
                  className={[
                    'h-full rounded-full transition-all duration-300',
                    row.accent === 'cyan'
                      ? 'bg-cyan-signal'
                      : row.accent === 'gold'
                        ? 'bg-gold-signal'
                        : 'bg-emerald-signal',
                  ].join(' ')}
                  style={{ width: `${row.pct * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-text-muted">{Math.round(row.pct * 100)}% of gross</p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="Interactive Cue Sheet Verifier"
        subtitle="Inspect audio/video fingerprint with cryptographic chain-of-title."
      >
        <label className="block text-sm text-text-muted">
          Fingerprint / cue reference
          <input
            value={fingerprint}
            onChange={(e) => {
              setFingerprint(e.target.value)
              setVerified(false)
            }}
            className="mt-1.5 w-full rounded-xl border border-border-subtle bg-void/70 px-3.5 py-2.5 font-mono text-sm text-text-primary outline-none transition focus:border-cyan-signal/45"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setFingerprint(`cue://upload-${Date.now().toString(36)}`)
              setVerified(false)
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-void-elevated/70 px-3.5 py-2.5 text-sm text-text-muted transition hover:border-cyan-signal/35 hover:text-cyan-signal"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Simulate Upload
          </button>
          <button
            type="button"
            onClick={() => setVerified(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-signal to-indigo-signal px-3.5 py-2.5 text-sm font-semibold text-void transition hover:brightness-110"
          >
            <FileAudio className="h-4 w-4" aria-hidden />
            Verify Chain-of-Title
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-border-subtle bg-void/50 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-text-muted">
            <Link2 className="h-3.5 w-3.5 text-cyan-signal" aria-hidden />
            Chain hash
          </div>
          <p className="break-all font-mono text-xs text-cyan-signal sm:text-sm">
            {truncateHash(chainHash, 18)}
          </p>
          {verified && (
            <p role="status" className="mt-3 text-sm text-emerald-signal">
              Cue sheet verified · Title chain intact · Sync license eligible
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
