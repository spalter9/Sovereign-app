import { useCallback, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileSearch,
  Loader2,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { examineFile, type ExaminerFinding } from '../../lib/examiner/client'

/**
 * The Authorship Examiner, as its own console module.
 *
 * Everything runs in this browser: the file is decoded with the page's own
 * AudioContext, separated into four sources, measured stem by stem and scored,
 * without a byte leaving the machine.
 */

const VERDICT_TONE: Record<string, string> = {
  HUMAN_AUTHORED: 'border-emerald-600 bg-emerald-950/60 text-emerald-300',
  HYBRID_AI_ASSISTED: 'border-amber-600 bg-amber-950/50 text-amber-300',
  AI_GENERATED: 'border-rose-600 bg-rose-950/50 text-rose-300',
  INDETERMINATE: 'border-slate-600 bg-slate-900 text-slate-300',
}

const STATUS_TONE: Record<string, string> = {
  CLAIMABLE: 'border-emerald-600 bg-emerald-950/60 text-emerald-300',
  PARTIAL_CLAIM: 'border-amber-600 bg-amber-950/50 text-amber-300',
  MUST_EXCLUDE: 'border-rose-600 bg-rose-950/50 text-rose-300',
  UNDETERMINED: 'border-slate-600 bg-slate-900 text-slate-400',
}

const GROUP_TITLE: Record<string, string> = {
  vocals: 'Vocals',
  drums: 'Drums & percussion',
  bass_and_harmony: 'Bass & harmony',
}

const words = (value: string) => value.replace(/_/g, ' ')

function fmt(value: number | null | undefined, places: number, suffix = ''): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toFixed(places)}${suffix}`
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        })
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-900/40"
    >
      {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function ExaminerModule() {
  const [finding, setFinding] = useState<ExaminerFinding | null>(null)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const [fraction, setFraction] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const run = useCallback(async (file: File) => {
    setBusy(true)
    setError(null)
    setFinding(null)
    setStage('Reading')
    setFraction(0)
    try {
      const result = await examineFile(file, (s, f) => {
        setStage(s)
        setFraction(f)
      })
      setFinding(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The examiner could not read that container.')
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-xs font-bold text-slate-300">
          Separates a record into vocals, drums, bass and harmony, measures each one for the
          physical traces of a human performance, and drafts the Copyright Office limitation of
          claim from the result.
        </p>
        <p className="mt-1.5 font-mono text-[10px] text-slate-500">
          Decoded, separated and measured in this browser. Nothing is uploaded.
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
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-500/40 bg-[#050a15] px-4 py-6 text-xs font-black uppercase tracking-wider text-cyan-300 transition hover:border-cyan-400/70 hover:bg-cyan-950/20 disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {stage}…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" aria-hidden /> Examine a container
          </>
        )}
      </button>

      {busy ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${Math.max(2, Math.round(fraction * 100))}%` }}
          />
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-700 bg-rose-950/40 px-4 py-3 text-xs font-bold text-rose-300">
          {error}
        </p>
      ) : null}

      {finding ? (
        <div className="space-y-4">
          {/* Headline verdict */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
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
                {words(finding.verdict)}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                  style={{ width: `${Math.round(finding.authorshipIndex * 100)}%` }}
                />
              </div>
              <span className="font-mono text-xs tabular-nums text-slate-200">
                {(finding.authorshipIndex * 100).toFixed(1)} / 100
              </span>
            </div>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Authorship index · {words(finding.eligibility).toLowerCase()}
            </p>
            <p className="mt-3 break-all font-mono text-[10px] text-slate-600">
              intake sha256 {finding.sha256}
            </p>
          </div>

          {/* Per-source verdicts */}
          <div className="space-y-3">
            {finding.stems.map((stem) => (
              <div key={stem.stem} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-white">
                      {GROUP_TITLE[stem.stem] ?? stem.stem}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                      {words(stem.verdict).toLowerCase()} ·{' '}
                      {(stem.energy_share * 100).toFixed(1)}% of programme energy · confidence{' '}
                      {(stem.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                      STATUS_TONE[stem.copyright_status] ?? STATUS_TONE.UNDETERMINED
                    }`}
                  >
                    {words(stem.copyright_status)}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        stem.copyright_status === 'MUST_EXCLUDE'
                          ? 'bg-rose-500'
                          : stem.copyright_status === 'CLAIMABLE'
                            ? 'bg-emerald-400'
                            : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.round(stem.human_score * 100)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] tabular-nums text-slate-400">
                    {(stem.human_score * 100).toFixed(0)}
                  </span>
                </div>

                <dl className="mt-3 space-y-1.5">
                  {stem.features.map((f) => (
                    <div key={f.id} className="flex flex-wrap items-baseline justify-between gap-2">
                      <dt className="text-[11px] text-slate-300">{f.label}</dt>
                      <dd className="font-mono text-[10px] text-slate-500">
                        {f.interpretation}{' '}
                        <span className="text-slate-600">(w {f.weight.toFixed(2)})</span>
                      </dd>
                    </div>
                  ))}
                  {stem.features.length === 0 ? (
                    <p className="font-mono text-[10px] text-slate-600">
                      Nothing measurable in this source.
                    </p>
                  ) : null}
                </dl>
              </div>
            ))}
          </div>

          {/* The filing language */}
          <div className="rounded-xl border border-cyan-600/40 bg-cyan-950/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                Limitation of claim · 17 U.S.C. § 409(9)
              </p>
              <CopyButton text={finding.dossier.eCO_copy_paste_text} />
            </div>
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-slate-200">
              {finding.dossier.eCO_copy_paste_text || 'No limitation language required.'}
            </p>
            <dl className="mt-3 space-y-1 border-t border-cyan-900/50 pt-3 text-[11px]">
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                  Material excluded
                </dt>
                <dd className="text-slate-300">{finding.dossier.material_excluded}</dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                  New material included
                </dt>
                <dd className="text-slate-300">{finding.dossier.new_material_included}</dd>
              </div>
            </dl>
            {finding.dossier.claim_blocked ? (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-[11px] font-bold text-rose-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                No group reached the threshold for an affirmative claim. Do not file on this
                evidence alone.
              </p>
            ) : null}
          </div>

          {/* Programme and delivery */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                Programme
              </p>
              <dl className="mt-3 space-y-1.5 font-mono text-[10px]">
                {(
                  [
                    [
                      'Integrated',
                      finding.container.integrated_lufs === null
                        ? 'silent'
                        : `${fmt(finding.container.integrated_lufs, 2)} LUFS`,
                    ],
                    ['Loudness range', fmt(finding.container.loudness_range_lu, 2, ' LU')],
                    ['True peak', fmt(finding.container.true_peak_dbtp, 2, ' dBTP')],
                    ['Spectral cliff', fmt(finding.container.spectral_cliff_hz, 0, ' Hz')],
                    ['Tempo', fmt(finding.container.estimated_tempo_bpm, 1, ' BPM')],
                  ] as [string, string][]
                ).map(([k, v]) => (
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
                          ? 'border-rose-700 bg-rose-950/50 text-rose-300'
                          : d.status === 'on_target'
                            ? 'border-emerald-700 bg-emerald-950/50 text-emerald-300'
                            : 'border-slate-700 bg-slate-800/60 text-slate-400'
                      }`}
                    >
                      {words(d.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-[11px] leading-relaxed text-slate-400">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" aria-hidden />
            Sources are estimated by harmonic-percussive separation and centre extraction in this
            browser, not by a trained separation model, so a source may carry traces of its
            neighbours. Measurements and weights are published above so a finding can be checked.
            This states measurements and the conclusions drawn from them; it is not legal advice,
            and the Copyright Office determines every application itself.
          </p>
        </div>
      ) : (
        !busy && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
            <FileSearch className="h-4 w-4 text-slate-600" aria-hidden />
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              No container examined
            </p>
          </div>
        )
      )}
    </div>
  )
}
