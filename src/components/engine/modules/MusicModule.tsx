import { useMemo, useState } from 'react'
import { AudioWaveform, Banknote, Headphones, Zap } from 'lucide-react'
import { formatNumber, formatUsd } from '../../../lib/format'
import { MUSIC_TRACKS } from '../../../lib/mockData'
import { SectionCard } from '../SectionCard'

const STEMS = ['Vocals', 'Drums', 'Bass', 'Synths', 'Ambience'] as const

export function MusicModule() {
  const [activeStem, setActiveStem] = useState<(typeof STEMS)[number]>('Vocals')
  const [spatial, setSpatial] = useState(0.65)
  const [lightningBurst, setLightningBurst] = useState(0)

  const catalogEarnings = useMemo(
    () =>
      MUSIC_TRACKS.reduce(
        (sum, track) => sum + track.streams * track.perStream,
        0,
      ),
    [],
  )

  return (
    <div className="tab-panel-enter grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SectionCard
        title="Layer-2 Lightning Micropayments"
        subtitle="Per-stream settlements route in real time across the catalog."
        glow
        action={
          <button
            type="button"
            onClick={() => setLightningBurst((n) => n + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gold-signal/30 bg-gold-signal/10 px-2.5 py-1.5 text-xs font-medium text-gold-signal transition hover:bg-gold-signal/20"
          >
            <Zap className="h-3.5 w-3.5" aria-hidden />
            Fire stream burst
          </button>
        }
      >
        <div className="mb-4 rounded-xl border border-emerald-signal/25 bg-emerald-signal/8 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-text-muted">
                Artists Forward debt-waiver
              </p>
              <p className="font-display text-lg font-semibold text-emerald-signal">
                Balance: $0.00
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-signal/35 bg-void/40 px-2.5 py-1 text-xs font-medium text-emerald-signal">
              <Banknote className="h-3.5 w-3.5" aria-hidden />
              Active Cash-Out enabled
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border-subtle">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-void-elevated/80 text-xs uppercase tracking-[0.1em] text-text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">Track</th>
                <th className="px-3 py-2.5 font-medium">ISRC</th>
                <th className="px-3 py-2.5 font-medium">Streams</th>
                <th className="px-3 py-2.5 font-medium">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {MUSIC_TRACKS.map((track) => (
                <tr key={track.id} className="border-t border-border-subtle">
                  <td className="px-3 py-2.5 text-text-primary">{track.title}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-cyan-signal">
                    {track.isrc}
                  </td>
                  <td className="px-3 py-2.5 text-text-muted">
                    {formatNumber(track.streams + lightningBurst * 120)}
                  </td>
                  <td className="px-3 py-2.5 font-display text-emerald-signal">
                    {formatUsd(
                      track.streams * track.perStream + lightningBurst * 120 * track.perStream,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-text-muted">
          Catalog accrued:{' '}
          <span className="font-display font-semibold text-text-primary">
            {formatUsd(catalogEarnings + lightningBurst * 120 * 0.004)}
          </span>
        </p>
      </SectionCard>

      <SectionCard
        title="Stem Isolation & 3D Spatial Preview"
        subtitle="Preview isolated stems with spatial depth control."
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {STEMS.map((stem) => (
            <button
              key={stem}
              type="button"
              onClick={() => setActiveStem(stem)}
              className={[
                'rounded-lg border px-3 py-1.5 text-sm transition',
                activeStem === stem
                  ? 'border-cyan-signal/45 bg-cyan-signal/10 text-cyan-signal'
                  : 'border-border-subtle text-text-muted hover:border-cyan-signal/30 hover:text-text-primary',
              ].join(' ')}
            >
              {stem}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border-subtle bg-void/50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm text-text-primary">
            <AudioWaveform className="h-4 w-4 text-cyan-signal" aria-hidden />
            Isolating: <span className="font-semibold">{activeStem}</span>
          </div>
          <div className="mb-4 flex h-16 items-end gap-1">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-cyan-signal/70"
                style={{
                  height: `${20 + ((i * 17 + activeStem.length * 9) % 70)}%`,
                  opacity: 0.35 + (i % 5) * 0.12,
                }}
              />
            ))}
          </div>

          <label className="block text-sm text-text-muted">
            <span className="mb-2 inline-flex items-center gap-2">
              <Headphones className="h-4 w-4 text-gold-signal" aria-hidden />
              Spatial depth ({Math.round(spatial * 100)}%)
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={spatial}
              onChange={(e) => setSpatial(Number(e.target.value))}
              className="mt-2 w-full"
              aria-valuetext={`${Math.round(spatial * 100)} percent spatial depth`}
            />
          </label>
        </div>
      </SectionCard>
    </div>
  )
}
