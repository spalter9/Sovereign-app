import { useState, type ReactNode } from 'react'
import { AudioTransport } from './AudioTransport'

interface SspEngineConsoleProps {
  onLock: () => void
  onOpenMaster: () => void
  onOpenSurealizer: () => void
}

const TABS = [
  'Transport',
  'Mastering',
  'Spatial BOOM',
  'Stems',
  'Writer Code',
  'Tax & Polygon',
  'AI Defense',
  'Spalty AI',
  'Markets & Media',
  'Diagnostics',
] as const

export function SspEngineConsole({
  onLock,
  onOpenMaster,
  onOpenSurealizer,
}: SspEngineConsoleProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [status, setStatus] = useState('ONLINE // LOCKED')

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#020408] text-white">
      <header className="sticky top-0 z-50 flex h-auto min-h-16 shrink-0 flex-col gap-3 border-b border-slate-800 bg-[#070b14]/95 px-4 py-3 backdrop-blur-md md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 animate-pulse rounded-full bg-cyan-400" aria-hidden />
            <div>
              <h1 className="text-xs font-black uppercase tracking-wider text-white md:text-sm">
                SSPENGINE.COM <span className="text-cyan-400">// COMPLETE SUITE</span>
              </h1>
              <p className="font-mono text-[10px] text-slate-400">{status}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLock}
            className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-rose-200 md:hidden"
          >
            Lock
          </button>
        </div>

        <nav
          className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar"
          aria-label="SSP Engine modules"
        >
          {TABS.map((label, index) => {
            const active = index === activeTab
            return (
              <button
                key={label}
                type="button"
                onClick={() => setActiveTab(index)}
                className={
                  active
                    ? 'shrink-0 rounded-lg bg-cyan-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-950 transition-all'
                    : 'shrink-0 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 transition-all hover:text-white'
                }
              >
                {index + 1}. {label}
              </button>
            )
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={onOpenMaster}
            className="rounded-lg border border-cyan-500/35 bg-cyan-950/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-200"
          >
            Master Engine
          </button>
          <button
            type="button"
            onClick={onOpenSurealizer}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-300"
          >
            Surealizer
          </button>
          <button
            type="button"
            onClick={onLock}
            className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-rose-200"
          >
            Lock / Sign Out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-6 pb-20 md:p-10">
        {activeTab === 0 && (
          <Panel title="Transport & Audio Ingest" badge="READY">
            <AudioTransport onStatus={setStatus} />
          </Panel>
        )}

        {activeTab === 1 && (
          <Panel title="Elite Mastering Chain & Signature Presets">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                ['The Dre Preset', 'Deep sub-bass punch, crisp highs, heavy analog warmth compression.'],
                ['The Adam Kagan Preset', 'Pristine clarity, transparent mastering curve, balanced transient response.'],
                ['The Manny Preset', 'Vocal-forward harmonic saturation, rich mid-range density, radio-ready limit.'],
              ].map(([name, desc]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setStatus(`PRESET // ${name.toUpperCase()}`)}
                  className="space-y-2 rounded-xl border border-slate-700 bg-slate-900 p-4 text-left transition-all hover:border-cyan-400"
                >
                  <h3 className="text-xs font-black uppercase text-white">{name}</h3>
                  <p className="text-[10px] font-bold text-slate-400">{desc}</p>
                </button>
              ))}
            </div>
          </Panel>
        )}

        {activeTab === 2 && (
          <Panel title='Spatial Audio & 3D "BOOM" Engine'>
            <p className="text-xs font-bold text-slate-300">
              Immersive 3D soundfield positioning and width enhancement engine.
            </p>
            <Action onClick={() => setStatus('BOOM ENGINE // ENGAGED')}>
              ⚡ Activate 3D BOOM Staging
            </Action>
          </Panel>
        )}

        {activeTab === 3 && (
          <Panel title="Stem Isolation & Forensic Analysis">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                ['VOCALS', 'bg-cyan-500', 'text-cyan-300'],
                ['DRUMS', 'bg-emerald-500', 'text-emerald-300'],
                ['BASS', 'bg-purple-500', 'text-purple-300'],
                ['INSTRUMENTS', 'bg-amber-500', 'text-amber-300'],
              ].map(([label, bar, text]) => (
                <div
                  key={label}
                  className="space-y-2 rounded-xl border border-slate-800 bg-slate-900 p-4 text-center"
                >
                  <span className={`text-xs font-black ${text}`}>{label}</span>
                  <div className={`h-2 rounded-full ${bar}`} />
                </div>
              ))}
            </div>
          </Panel>
        )}

        {activeTab === 4 && (
          <Panel title="Writer-Code & Cryptographic Ingest">
            <p className="text-xs font-bold text-slate-300">
              Hardcode immutable creator metadata and ownership attribution directly into audio
              waveforms.
            </p>
            <input
              type="text"
              placeholder="Enter Writer / IPI / Creator ID..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
            />
            <Action onClick={() => setStatus('WRITER CODE // BURNED')}>
              Embed Cryptographic Metadata
            </Action>
          </Panel>
        )}

        {activeTab === 5 && (
          <Panel title="Automated Tax & Polygon Settlement">
            <p className="text-xs font-bold text-slate-300">
              Real-time cross-border royalty calculation with automated tax withholding on Polygon.
            </p>
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4">
              <span className="text-xs font-black text-slate-400">GASLESS SETTLEMENT LEDGER</span>
              <span className="text-xs font-black text-emerald-400">CONNECTED // ACTIVE</span>
            </div>
            <Action onClick={onOpenMaster}>Open Live IRS Tax Terminal</Action>
          </Panel>
        )}

        {activeTab === 6 && (
          <Panel title="AI Crawler Defense & Perimeter Toll Gate">
            <p className="text-xs font-bold text-slate-300">
              Active threat detection intercepting unauthorized AI training scrapers with smart
              contract tolls.
            </p>
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex justify-between text-xs font-black">
                <span className="text-slate-400">SHIELD STATUS:</span>
                <span className="text-cyan-400">ARMED &amp; MONITORING</span>
              </div>
            </div>
          </Panel>
        )}

        {activeTab === 7 && (
          <Panel title="Spalty AI Co-Producer Suite">
            <p className="text-xs font-bold text-slate-300">
              Intelligent arrangement suggestions, mix critique, and automated stem remixing
              prompts.
            </p>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs font-bold text-slate-300">
              &quot;Spalty AI Ready: Analyze current stems or request mix adjustments.&quot;
            </div>
          </Panel>
        )}

        {activeTab === 8 && (
          <Panel title="Global Markets, Social Media & Video Game Ecosystem">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {[
                [
                  'Social Media Creator Economy',
                  'text-cyan-300',
                  'Short-form platforms rely on SSP Engine browser mastering and instant 3D spatial toggles (BOOM) without heavy desktop DAWs.',
                ],
                [
                  'Gaming & Interactive Media',
                  'text-emerald-300',
                  'Realtime spatial audio and micro-transaction settlement for in-game music, SFX, and creator audio skins.',
                ],
                [
                  'Polygon Settlements & Auto-Tax',
                  'text-purple-300',
                  'Gasless micro-payout ledgers and automated tax calculation at transaction ingest.',
                ],
                [
                  'AI Crawler Defense Perimeter',
                  'text-amber-300',
                  'Intercept scrapers and execute Polygon toll gates before granting data access.',
                ],
              ].map(([title, color, body]) => (
                <div key={title} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
                  <h3 className={`text-xs font-black uppercase tracking-wider ${color}`}>{title}</h3>
                  <p className="text-xs font-bold leading-relaxed text-slate-300">{body}</p>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {activeTab === 9 && (
          <Panel title="System Diagnostics & Export Hub">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="CPU LOAD" value="1.2%" tone="text-cyan-400" />
              <Stat label="DSP LATENCY" value="0.4ms" tone="text-emerald-400" />
              <Stat label="SESSION" value="SECURE" tone="text-cyan-400" />
              <Stat label="CHAIN" value="POLYGON" tone="text-emerald-400" />
            </div>
            <Action onClick={() => setStatus('EXPORT // 32-BIT MASTER QUEUED')}>
              Export 32-Bit Master WAV // FLAC // Stems
            </Action>
          </Panel>
        )}

        <div className="flex flex-wrap gap-2 md:hidden">
          <Ghost onClick={onOpenMaster}>Master Engine</Ghost>
          <Ghost onClick={onOpenSurealizer}>Surealizer</Ghost>
        </div>
      </main>
    </div>
  )
}

function Panel({
  title,
  badge,
  children,
}: {
  title: string
  badge?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-cyan-500/30 bg-[#0a0f1d] p-6 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-cyan-400">
          {title}
        </h2>
        {badge ? (
          <span className="rounded-full border border-emerald-800 bg-emerald-950/60 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-400">
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function Action({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-cyan-500 px-6 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-400"
    >
      {children}
    </button>
  )
}

function Ghost({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-wider text-white transition-all hover:border-slate-500"
    >
      {children}
    </button>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: string
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
      <span className="text-[10px] font-black text-slate-400">{label}</span>
      <p className={`mt-1 text-sm font-black ${tone}`}>{value}</p>
    </div>
  )
}
