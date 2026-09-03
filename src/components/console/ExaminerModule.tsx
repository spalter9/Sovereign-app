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
import {
  examineFile,
  readLyricsFromAudio,
  type ExaminerFinding,
  type LyricReading,
} from '../../lib/examiner/client'
import { analyseLyrics, type LyricAnalysis } from '../../lib/examiner/lyric-analysis'
import { combineVerdict } from '../../lib/examiner/verdict'
import {
  recordLyrics,
  toDeclarationJson,
  type LyricRecord,
  type RightsPosture,
} from '../../lib/examiner/lyrics'

/**
 * The Authorship Examiner, as its own console module.
 *
 * Everything runs in this browser: the file is decoded with the page's own
 * AudioContext, separated into four sources, measured stem by stem and scored,
 * without a byte leaving the machine.
 */



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
  // Held here rather than inside the lyric panel: the combined verdict at the
  // top needs both halves, and a record has two authorships to report.
  const [lyricAnalysis, setLyricAnalysis] = useState<LyricAnalysis | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const run = useCallback(async (file: File) => {
    setBusy(true)
    setError(null)
    setFinding(null)
    setLyricAnalysis(null)
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
          {/* One answer, from the validated signals only. */}
          <CombinedVerdictPanel finding={finding} lyrics={lyricAnalysis} />

          {/* Per-source measurements.
              These carried claim-eligibility verdicts until they were tested
              against eight tracks of known provenance, where every feature's
              range for generated audio overlapped its range for recorded
              audio. The measurements are real and worth showing; the verdicts
              they fed were not, and are gone rather than merely caveated. */}
          <details className="rounded-xl border border-slate-800 bg-slate-900/60">
            <summary className="cursor-pointer p-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Per-source performance measurements — not validated, no verdict drawn
            </summary>
            <div className="border-t border-slate-800 p-4">
              <p className="mb-3 rounded-lg border border-amber-700/50 bg-amber-950/25 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
                Tested against eight tracks of known provenance, none of these features separated
                generated audio from recorded audio — the two populations overlapped on every
                one. They are shown because they are real measurements of the performance, and
                because a reader should be able to see them. No authorship conclusion is drawn
                from them, and none should be.
              </p>
          <div className="space-y-3">
            {finding.stems.map((stem) => (
              <div key={stem.stem} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-white">
                      {GROUP_TITLE[stem.stem] ?? stem.stem}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                      {(stem.energy_share * 100).toFixed(1)}% of programme energy
                    </p>
                  </div>
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
            </div>
          </details>

          {/* The stem-derived limitation of claim was here. It drafted text for
              someone to paste into a Copyright Office application out of the
              same per-stem verdicts that failed validation — the highest-
              consequence output in the app resting on its least reliable
              input. Filing language now comes only from the authorship record
              below, built from what the applicant asserts plus evidence
              binding it to the recording, which is what the Office acts on. */}

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

          {/* The one signal that separated real material. Shown on its own,
              because averaging it into features that did not would hide
              both results. */}
          <div
            className={`rounded-xl border p-4 ${
              finding.provenance.resembles === 'generated'
                ? 'border-rose-700/60 bg-rose-950/20'
                : finding.provenance.resembles === 'recorded'
                  ? 'border-emerald-700/60 bg-emerald-950/20'
                  : 'border-slate-700 bg-slate-900'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                Recording provenance
              </p>
              <span className="font-mono text-[10px] tabular-nums text-slate-400">
                P(generated) {(finding.provenance.pGenerated * 100).toFixed(0)}% · slope{' '}
                flux {fmt(finding.provenance.detail?.specFluxSd ?? null, 3)} · coh{' '}
                {fmt(finding.provenance.detail?.stereoCohHi ?? null, 2)}
              </span>
            </div>
            <p className="mt-2 text-[12px] font-bold leading-relaxed text-slate-200">
              Recording resembles {finding.provenance.resembles} audio.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              {finding.provenance.note}
            </p>
            {finding.provenance.excerpts.length > 1 ? (
              <p className="mt-2 font-mono text-[10px] text-slate-600">
                passages:{' '}
                {finding.provenance.excerpts.map((p) => (p * 100).toFixed(0)).join(' · ')}
              </p>
            ) : null}
            <p className="mt-2 text-[10px] leading-relaxed text-amber-300/90">
              A screening signal, ~77% accurate held out over 46 tracks of known provenance —
              real information, but far from proof, and it abstains whenever a track is not
              clearly one or the other. It should never be the basis of a filing; the
              authorship record below is what carries that weight.
            </p>
          </div>

          <LyricScanPanel onAnalysis={setLyricAnalysis} />

          <LyricRecordPanel audioHash={finding.sha256} fileName={finding.fileName} />

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


/**
 * Lyric authorship record.
 *
 * Not a detector — see lyrics.ts. This fixes what the applicant claims, when,
 * and against which recording, which is the evidence that actually supports a
 * claim to the words when the recording itself is machine-generated.
 */
function LyricRecordPanel({ audioHash, fileName }: { audioHash: string; fileName: string }) {
  const [raw, setRaw] = useState('')
  const [posture, setPosture] = useState<RightsPosture>({
    lyricsAuthored: true,
    recordingGenerated: true,
    musicAuthored: false,
  })
  const [record, setRecord] = useState<LyricRecord | null>(null)

  const toggle = (key: keyof RightsPosture) =>
    setPosture((p) => ({ ...p, [key]: !p[key] }))

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
        Lyric authorship record
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
        Fixes your words against this recording's hash and drafts the claim. It records what you
        assert; it does not try to detect who wrote the text, because no reliable method for
        that exists.
      </p>

      <textarea
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value)
          setRecord(null)
        }}
        rows={6}
        placeholder="Paste your lyrics as written…"
        aria-label="Lyrics as written"
        className="mt-3 w-full rounded-lg border border-slate-700 bg-[#050a15] px-3 py-2 font-mono text-[11px] text-slate-200 outline-none focus:border-cyan-500/60"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ['lyricsAuthored', 'I wrote the lyrics'],
            ['musicAuthored', 'I composed the music'],
            ['recordingGenerated', 'The recording is AI-generated'],
          ] as [keyof RightsPosture, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              toggle(key)
              setRecord(null)
            }}
            className={`rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
              posture[key]
                ? 'border-cyan-500/60 bg-cyan-950/50 text-cyan-300'
                : 'border-slate-700 bg-slate-900 text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!raw.trim()}
        onClick={() => {
          void recordLyrics({ raw, audioHash, posture }).then(setRecord)
        }}
        className="mt-3 w-full rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-900/40 disabled:opacity-40"
      >
        Fix this record
      </button>

      {record ? (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-700 bg-[#050a15] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-slate-500">
              {record.lineCount} lines · {record.wordCount} words · fixed{' '}
              {new Date(record.fixedAt).toLocaleString()}
            </span>
            <CopyButton text={toDeclarationJson(record, fileName)} />
          </div>
          <p className="break-all font-mono text-[10px] text-slate-500">
            lyrics sha256 {record.textHash}
          </p>
          <p className="break-all font-mono text-[10px] text-slate-500">
            cross-hash {record.crossHash}
          </p>
          <p className="border-t border-slate-800 pt-2 font-mono text-[11px] leading-relaxed text-slate-200">
            {record.eCoText}
          </p>
        </div>
      ) : null}
    </div>
  )
}


const LEANING_TONE: Record<string, string> = {
  reads_human_written: 'border-emerald-600 bg-emerald-950/60 text-emerald-300',
  reads_generated: 'border-rose-600 bg-rose-950/50 text-rose-300',
  inconclusive: 'border-slate-600 bg-slate-900 text-slate-300',
}

/**
 * Read the lyrics off the recording and judge the writing.
 *
 * Transcription is a separate button because it downloads a recognition model
 * on first use — a cost worth choosing rather than imposing on every audit.
 */
function LyricScanPanel({ onAnalysis }: { onAnalysis: (a: LyricAnalysis | null) => void }) {
  const [reading, setReading] = useState<LyricReading | null>(null)
  const [text, setText] = useState('')
  const [analysis, setAnalysis] = useState<LyricAnalysis | null>(null)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const [error, setError] = useState<string | null>(null)

  // A transcript the gate rejected cannot be scanned until someone has
  // actually changed it. Analysing recogniser noise would produce a confident
  // reading of something nobody sang, which is the one output this must never
  // give — editing it is the whole point of showing it.
  const unreviewedGarbage =
    reading !== null &&
    !reading.transcript.quality.usable &&
    text.trim() === reading.transcript.lines.join('\n').trim()

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
          Lyric scan — writing style
        </p>
        {analysis && !analysis.tooShort ? (
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
              LEANING_TONE[analysis.leaning] ?? LEANING_TONE.inconclusive
            }`}
          >
            {words(analysis.leaning)}
          </span>
        ) : null}
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
        Paste the lyrics, or have the vocal transcribed and correct what comes back. Either way
        the writing is measured here in this browser.
      </p>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setAnalysis(null)
          onAnalysis(null)
        }}
        rows={7}
        placeholder="Paste the lyrics — or use Transcribe and edit what comes back…"
        aria-label="Lyrics to scan"
        className="mt-3 w-full rounded-lg border border-slate-700 bg-[#050a15] px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-200 outline-none focus:border-cyan-500/60"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!text.trim() || unreviewedGarbage}
          title={
            unreviewedGarbage
              ? 'Correct the transcript first — it does not look like lyrics.'
              : undefined
          }
          onClick={() => {
            const a = analyseLyrics(text)
            setAnalysis(a)
            onAnalysis(a)
          }}
          className="flex-1 rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-900/40 disabled:opacity-40"
        >
          Scan this writing
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            setError(null)
            readLyricsFromAudio((s) => setStage(s))
              .then((r) => {
                setReading(r)
                // Recognition on a sung vocal is imperfect, so the transcript
                // lands in the editable box rather than straight into a
                // verdict. The reading is only ever as good as the words.
                setText(r.transcript.lines.join('\n'))
                setAnalysis(null)
                onAnalysis(null)
              })
              .catch((e: unknown) =>
                setError(e instanceof Error ? e.message : 'Transcription failed.'),
              )
              .finally(() => setBusy(false))
          }}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-40"
        >
          {busy ? `${stage}…` : 'Transcribe the vocal'}
        </button>
      </div>

      {busy ? (
        <p className="mt-2 text-[10px] text-slate-500">
          First run downloads a speech model (~40 MB), cached afterwards. The audio never leaves
          this machine.
        </p>
      ) : null}

      {reading ? (
        <div className="mt-2 space-y-2">
          <p className="font-mono text-[10px] text-slate-500">
            Transcribed {reading.transcript.analysedSec.toFixed(0)}s with{' '}
            {reading.transcript.model} — check the words before trusting the reading.
          </p>
          {reading.transcript.quality.warning ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-[11px] font-bold leading-relaxed text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {reading.transcript.quality.warning}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-[11px] font-bold text-rose-300">
          {error}
        </p>
      ) : null}

      {analysis ? (
        analysis.tooShort ? (
          <p className="mt-3 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">
            {analysis.note}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400"
                  style={{ width: `${Math.round(analysis.index * 100)}%` }}
                />
              </div>
              <span className="font-mono text-xs tabular-nums text-slate-200">
                {(analysis.index * 100).toFixed(0)} / 100
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">{analysis.note}</p>

            <dl className="space-y-1.5 border-t border-slate-800 pt-3">
              {analysis.features.map((f) => (
                <div key={f.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <dt className="text-[11px] text-slate-300">{f.label}</dt>
                  <dd className="font-mono text-[10px] text-slate-500">
                    {f.reading} <span className="text-slate-600">(w {f.weight.toFixed(2)})</span>
                  </dd>
                </div>
              ))}
            </dl>

            <p className="text-[10px] leading-relaxed text-amber-300/90">
              A leaning from writing style, not proof of authorship. It calls writing generated
              only when the markers are positively present — abstract or repetitive lyrics are
              ordinary in songs and are never treated as evidence of a machine.
            </p>
          </div>
        )
      ) : null}
    </div>
  )
}


const STRENGTH_TONE: Record<string, string> = {
  measured: 'border-cyan-600/60 bg-cyan-950/30 text-cyan-200',
  leaning: 'border-amber-600/60 bg-amber-950/30 text-amber-200',
  not_established: 'border-slate-700 bg-slate-900 text-slate-400',
}

const STRENGTH_LABEL: Record<string, string> = {
  measured: 'measured',
  leaning: 'leaning',
  not_established: 'not established',
}

/**
 * The answer, up front, from the signals that survived validation.
 *
 * The per-stem performance verdict is deliberately absent here. It failed
 * against eight tracks of known provenance — every one of its features
 * overlapped between generated and recorded audio — so putting its number at
 * the top would be handing someone a confident figure with nothing behind it.
 * Its measurements are still shown further down, labelled for what they are.
 */
function CombinedVerdictPanel({
  finding,
  lyrics,
}: {
  finding: ExaminerFinding
  lyrics: LyricAnalysis | null
}) {
  const verdict = combineVerdict(finding.provenance, lyrics)
  const sides = [verdict.recording, verdict.lyrics]

  return (
    <div className="rounded-xl border border-cyan-600/40 bg-[#050a15] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-white">
            {finding.fileName}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-500">
            {fmt(finding.durationSec, 2, ' s')} · {finding.sampleRate} Hz · {finding.channels} ch
          </p>
        </div>
        <span className="rounded-full border border-cyan-600/50 bg-cyan-950/40 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-cyan-300">
          Reading
        </span>
      </div>

      <p className="mt-4 font-display text-lg leading-snug text-white">{verdict.headline}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {sides.map((side) => (
          <div
            key={side.side}
            className={`rounded-lg border p-3 ${STRENGTH_TONE[side.strength] ?? STRENGTH_TONE.not_established}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wider">
                {side.side === 'recording' ? 'The recording' : 'The words'}
              </p>
              <span className="font-mono text-[9px] uppercase tracking-wider opacity-70">
                {STRENGTH_LABEL[side.strength]}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] font-bold leading-snug">{side.finding}</p>
            <p className="mt-1 text-[11px] leading-relaxed opacity-80">{side.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/70 p-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          What this supports
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-200">{verdict.filingNote}</p>
      </div>

      <ul className="mt-3 space-y-1">
        {verdict.caveats.map((c) => (
          <li key={c.slice(0, 32)} className="flex gap-2 text-[10px] leading-relaxed text-slate-500">
            <span aria-hidden>·</span>
            {c}
          </li>
        ))}
      </ul>

      <p className="mt-3 break-all font-mono text-[10px] text-slate-600">
        intake sha256 {finding.sha256}
      </p>
    </div>
  )
}
