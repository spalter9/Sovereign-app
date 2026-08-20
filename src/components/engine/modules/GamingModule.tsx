import { useMemo, useState } from 'react'
import { Fingerprint, ShieldCheck, Sparkles } from 'lucide-react'
import { formatUsd, mockAssetHash, truncateHash } from '../../../lib/format'
import { SectionCard } from '../SectionCard'

const SKIN_PRICE = 4.99
const SPLITS = [
  { label: 'Game Studio', pct: 0.6, accent: 'text-cyan-signal' },
  { label: 'Mod Creator', pct: 0.25, accent: 'text-emerald-signal' },
  { label: 'IRS Auto-Tax Withholding', pct: 0.15, accent: 'text-gold-signal' },
] as const

export function GamingModule() {
  const [purchased, setPurchased] = useState(false)
  const [itemName, setItemName] = useState('Nebula Edge — Plasma Skin')
  const [playerTag, setPlayerTag] = useState('PLAYER://nova-7f2a')

  const amounts = useMemo(
    () =>
      SPLITS.map((s) => ({
        ...s,
        amount: Number((SKIN_PRICE * s.pct).toFixed(2)),
      })),
    [],
  )

  const assetHash = useMemo(
    () => mockAssetHash(`${itemName}|${playerTag}|${SKIN_PRICE}`),
    [itemName, playerTag],
  )

  return (
    <div className="tab-panel-enter grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SectionCard
        title="In-Game Microtransaction Router"
        subtitle="UGC mod royalty splits settle on purchase confirmation."
        glow
      >
        <div className="space-y-4">
          <label className="block text-sm text-text-muted">
            Item asset
            <input
              value={itemName}
              onChange={(e) => {
                setItemName(e.target.value)
                setPurchased(false)
              }}
              className="mt-1.5 w-full rounded-xl border border-border-subtle bg-void/70 px-3.5 py-2.5 text-text-primary outline-none transition focus:border-cyan-signal/45"
            />
          </label>
          <label className="block text-sm text-text-muted">
            Player provenance tag
            <input
              value={playerTag}
              onChange={(e) => {
                setPlayerTag(e.target.value)
                setPurchased(false)
              }}
              className="mt-1.5 w-full rounded-xl border border-border-subtle bg-void/70 px-3.5 py-2.5 font-mono text-sm text-text-primary outline-none transition focus:border-cyan-signal/45"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-void-elevated/60 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-text-muted">
                Simulator purchase
              </p>
              <p className="font-display text-2xl font-semibold text-text-primary">
                {formatUsd(SKIN_PRICE)}{' '}
                <span className="text-sm font-normal text-text-muted">weapon skin</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPurchased(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-signal to-emerald-signal px-4 py-2.5 text-sm font-semibold text-void transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-signal/70"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Simulate Purchase
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Real-Time Royalty Split"
        subtitle="Protocol calculates studio, creator, and IRS shares instantly."
      >
        <ul className="space-y-3">
          {amounts.map((row) => (
            <li
              key={row.label}
              className={[
                'flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-300',
                purchased
                  ? 'border-cyan-signal/25 bg-cyan-signal/5'
                  : 'border-border-subtle bg-void/40',
              ].join(' ')}
            >
              <div>
                <p className="text-sm font-medium text-text-primary">{row.label}</p>
                <p className="text-xs text-text-muted">{Math.round(row.pct * 100)}% allocation</p>
              </div>
              <p className={`font-display text-lg font-semibold ${row.accent}`}>
                {formatUsd(row.amount)}
              </p>
            </li>
          ))}
        </ul>
        {purchased && (
          <p
            role="status"
            className="mt-4 flex items-center gap-2 text-sm text-emerald-signal"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Split settled · IRS remittance queued (instant)
          </p>
        )}
      </SectionCard>

      <SectionCard
        className="lg:col-span-2"
        title="Immutable Item Provenance"
        subtitle="Cryptographic item asset hash bound to player tag."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold-signal/30 bg-gold-signal/10 text-gold-signal">
            <Fingerprint className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.14em] text-text-muted">
              Asset hash
            </p>
            <p className="truncate font-mono text-sm text-cyan-signal" title={assetHash}>
              {truncateHash(assetHash, 14)}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Full: <span className="break-all font-mono text-text-primary/80">{assetHash}</span>
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
