import { useRef, useState } from 'react'
import { FileSearch, Loader2, ShieldAlert, Upload } from 'lucide-react'
import { examineFile, type ExaminerFinding } from '../../lib/examiner/browser'

/**
 * The Examiner, inside AI Defense.
 *
 * AI Defense keeps other people's models off your catalogue. This is the
 * inward-facing half of the same question: how much of this record did a
 * machine make, and what does the Copyright Office need told about it.
 *
 * Everything here runs in the browser on a locally decoded file, so the
 * section's "nothing uploaded to a server" promise still holds. The cost is
 * that no stem separation happens, so this is a container-level preflight and
 * says so plainly rather than dressing itself up as a filing-grade finding.
 */

function fmt(value: number | null | undefined, places: number, suffix = ''): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toFixed(places)}${suffix}`
}

const VERDICT_TONE: Record<string, string> = {
  HUMAN_AUTHORED: 'border-emerald-700 bg-emerald-950/60 text-emerald-300',
  HYBRID_AI_ASSISTED: 'border-amber-700 bg-amber-950/50 text-amber-300',
  AI_GENERATED: 'border-rose-700 bg-rose-950/50 text-rose-300',
  INDETERMINATE: 'border-slate-700 bg-slate-900 text-slate-300',
}

export function AuthorshipExaminer() {
  const [finding, setFinding] = useState<ExaminerFinding | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function run(file: File) {
    setBusy(true)
    setError(null)
    try {
      setFinding(await examineFile(file))
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not read that container — ${err.message}`
          : 'Could not read that container.',
      )
      setFinding(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-xs font-bold text-slate-300">
          Measure how much of a record a person actually performed, and get the
          Copyright Office language that goes with the answer.
        </p>
        <p className="mt-1.5 font-mono text-[10px] text-slate-500">
          Decoded and measured in this browser — the file is never uploaded.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.wav,.aiff,.flac,.mp3,.m4a"
        className="hidden"
        aria-label="Container to examine"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void run(f)
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-500/40 bg-[#050a15] px-4 py-6 text-xs font-black uppercase tracking-wider text-cyan-300 transition hover:border-cyan-400/70 hover:bg-cyan-950/20 disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Examining…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" aria-hidden /> Examine a container
          </>
        )}
      </button>

      {error ? (
        <p className="rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-3 text-xs font-bold text-rose-300">
          {error}
        </p>
      ) : null}

      {finding ? (
        <div className="space-y-4">
          {/* The honest caveat sits above the verdict, not below it. */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-800/60 bg-amber-950/30 px-4 py-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
            <p className="text-[11px] font-bold leading-relaxed text-amber-200">
              Container-level preflight. Stem separation needs the forensics host,
              so this reads the whole mix at once and cannot say which source any
              finding belongs to — not yet a filing-grade result.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-white">
                  {finding.fileName}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                  {fmt(finding.durationSec, 2, ' s')} · {finding.sampleRate} Hz ·{' '}
                  {finding.channels} ch
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                  VERDICT_TONE[finding.verdict] ?? VERDICT_TONE.INDETERMINATE
                }`}
              >
                {finding.verdict.replace(/_/g, ' ')}
              </span>
            </div>

            {/* An unscored reading is not a zero. The examiner withholds a
                verdict below half the evidence weight, and a 0-length bar
                would read as "certainly machine-made" — the opposite of
                "not enough evidence to say". */}
            {finding.scored ? (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all"
                      style={{ width: `${Math.round(finding.authorshipIndex * 100)}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs tabular-nums text-slate-300">
                    {(finding.authorshipIndex * 100).toFixed(1)} / 100
                  </span>
                </div>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  Authorship index · {finding.eligibility.replace(/_/g, ' ').toLowerCase()}
                </p>
              </>
            ) : (
              <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  Not scored — insufficient evidence
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  {(finding.evidenceWeight * 100).toFixed(0)}% of the evidence weight was
                  measurable from the mix alone; a defensible verdict needs 50%. The
                  missing features are the per-source ones, which need separation.
                </p>
              </div>
            )}

            <p className="mt-3 break-all font-mono text-[10px] text-slate-600">
              intake sha256 {finding.sha256}
            </p>
          </div>

          {/* What was actually measured, with the weight each carried. */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
              Measured
            </p>
            <dl className="mt-3 space-y-2">
              {finding.reading.features.map((f) => (
                <div key={f.id} className="border-b border-slate-800/70 pb-2 last:border-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <dt className="text-xs font-bold text-slate-200">{f.label}</dt>
                    <span className="font-mono text-[10px] tabular-nums text-slate-500">
                      weight {f.weight.toFixed(2)}
                    </span>
                  </div>
                  <dd className="mt-0.5 font-mono text-[10px] text-slate-400">
                    {f.interpretation}
                  </dd>
                </div>
              ))}
              {finding.reading.features.length === 0 ? (
                <p className="font-mono text-[10px] text-slate-500">
                  No authorship feature could be measured from the mix alone.
                </p>
              ) : null}
            </dl>
          </div>

          {/* Loudness and delivery — measured on the same decode. */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                Programme
              </p>
              <dl className="mt-3 space-y-1.5 font-mono text-[10px]">
                {[
                  ['Integrated', finding.container.integrated_lufs === null
                    ? 'silent'
                    : `${fmt(finding.container.integrated_lufs, 2)} LUFS`],
                  ['Loudness range', fmt(finding.container.loudness_range_lu, 2, ' LU')],
                  ['True peak', fmt(finding.container.true_peak_dbtp, 2, ' dBTP')],
                  ['Spectral cliff', fmt(finding.container.spectral_cliff_hz, 0, ' Hz')],
                  ['Onsets', String(finding.container.onset_count)],
                  ['Tempo', fmt(finding.container.estimated_tempo_bpm, 1, ' BPM')],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-slate-300">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                Delivery
              </p>
              <ul className="mt-3 space-y-1.5">
                {finding.delivery.map((d) => (
                  <li key={d.platform} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-300">{d.platform}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase ${
                        d.status === 'would_clip'
                          ? 'border-rose-800 bg-rose-950/50 text-rose-300'
                          : d.status === 'on_target'
                            ? 'border-emerald-800 bg-emerald-950/50 text-emerald-300'
                            : 'border-slate-700 bg-slate-800/60 text-slate-400'
                      }`}
                    >
                      {d.status.replace(/_/g, ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
          <FileSearch className="h-4 w-4 text-slate-600" aria-hidden />
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            No container examined
          </p>
        </div>
      )}
    </div>
  )
}
