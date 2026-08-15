import { useMemo, useState } from 'react'
import { BadgeCheck, Bot, Coins, Database } from 'lucide-react'
import { formatUsd, mockAssetHash, truncateHash } from '../../../lib/format'
import { SectionCard } from '../SectionCard'

const MICRO_ROYALTY = 0.002

export function AiLicensingModule() {
  const [datasetId, setDatasetId] = useState('DIL-SET-ORBITAL-VOICE-v3')
  const [valid, setValid] = useState(false)
  const [prompts, setPrompts] = useState(0)
  const [generationType, setGenerationType] = useState<'stem' | 'vocal'>('stem')

  const licenseHash = useMemo(
    () => mockAssetHash(`dil|${datasetId}|holder`),
    [datasetId],
  )

  const accrued = prompts * MICRO_ROYALTY

  return (
    <div className="tab-panel-enter grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SectionCard
        title="Data & Identity License (DIL) Validator"
        subtitle="Validate AI training dataset licenses before model ingestion."
        glow
      >
        <label className="block text-sm text-text-muted">
          Dataset / DIL identifier
          <input
            value={datasetId}
            onChange={(e) => {
              setDatasetId(e.target.value)
              setValid(false)
            }}
            className="mt-1.5 w-full rounded-xl border border-border-subtle bg-void/70 px-3.5 py-2.5 font-mono text-sm text-text-primary outline-none transition focus:border-cyan-signal/45"
          />
        </label>

        <button
          type="button"
          onClick={() => setValid(datasetId.trim().length > 4)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-signal to-indigo-signal px-4 py-2.5 text-sm font-semibold text-void transition hover:brightness-110"
        >
          <Database className="h-4 w-4" aria-hidden />
          Validate DIL
        </button>

        <div className="mt-5 space-y-3 rounded-xl border border-border-subtle bg-void/45 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-text-muted">
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-signal" aria-hidden />
            License fingerprint
          </div>
          <p className="break-all font-mono text-xs text-cyan-signal sm:text-sm">
            {truncateHash(licenseHash, 16)}
          </p>
          {valid ? (
            <p role="status" className="text-sm text-emerald-signal">
              DIL valid · Rights holder binding active · Training use permitted
            </p>
          ) : (
            <p className="text-sm text-text-muted">
              Awaiting validation. Confirm dataset identity before metering prompts.
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Per-Prompt Micro-Metering"
        subtitle={`Every AI generation pays ${formatUsd(MICRO_ROYALTY, 3)} to the rights holder.`}
      >
        <div className="mb-4 flex gap-2">
          {(['stem', 'vocal'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setGenerationType(type)}
              className={[
                'rounded-lg border px-3 py-1.5 text-sm capitalize transition',
                generationType === type
                  ? 'border-gold-signal/40 bg-gold-signal/10 text-gold-signal'
                  : 'border-border-subtle text-text-muted hover:text-text-primary',
              ].join(' ')}
            >
              {type === 'stem' ? 'Audio stem' : 'Vocal style'}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!valid}
          onClick={() => setPrompts((n) => n + 1)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-signal/35 bg-cyan-signal/10 px-4 py-3 text-sm font-semibold text-cyan-signal transition hover:bg-cyan-signal/15 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Bot className="h-4 w-4" aria-hidden />
          Generate {generationType === 'stem' ? 'audio stem' : 'vocal style'} (+{formatUsd(MICRO_ROYALTY, 3)})
        </button>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border-subtle bg-void/40 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Prompts</p>
            <p className="font-display text-2xl font-semibold text-text-primary">{prompts}</p>
          </div>
          <div className="rounded-xl border border-emerald-signal/25 bg-emerald-signal/8 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">
              Accrued royalties
            </p>
            <p className="inline-flex items-center gap-1.5 font-display text-2xl font-semibold text-emerald-signal">
              <Coins className="h-5 w-5" aria-hidden />
              {formatUsd(accrued, 3)}
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
