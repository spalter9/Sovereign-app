import { analyseContainer } from './container'
import { evaluateDelivery, clearsAllPlatforms, type DeliveryVerdict } from './delivery-targets'
import { scoreStem, authorshipIndex, overallVerdict, claimEligibility } from './scoring'
import type { AudioBuffer32 } from './audio-types'
import type { ContainerReport, StemAnalysis } from './types'

/**
 * The examiner, running entirely in the browser.
 *
 * The console already decodes dropped audio locally and promises that nothing
 * is uploaded. This keeps that promise: the file is decoded with the browser's
 * own AudioContext and every measurement below runs on this machine. No bytes
 * leave it.
 *
 * What that costs is separation. HTDemucs needs a host, so there are no
 * per-source verdicts here — this is a container-level reading of the whole
 * mix. It is deliberately reported as a preflight rather than an examiner-grade
 * finding, because a finding that cannot say which stem it is talking about is
 * not the thing you file with.
 */

export type ExaminerFinding = {
  fileName: string
  /** SHA-256 of the exact bytes, fixed before anything touches the audio. */
  sha256: string
  durationSec: number
  sampleRate: number
  channels: number
  container: ContainerReport
  delivery: DeliveryVerdict[]
  clearsDelivery: boolean
  /** Container-level authorship reading, 0-1. Meaningless unless `scored`. */
  authorshipIndex: number
  /**
   * False when the examiner withheld a verdict for want of evidence. The index
   * is then 0 because nothing was scored, which is not the same as a zero
   * score — the UI must not draw it as one.
   */
  scored: boolean
  /** Share of the total feature weight that could actually be measured, 0-1. */
  evidenceWeight: number
  verdict: string
  eligibility: string
  /** The single scored group, kept so the UI can show the reasoning. */
  reading: StemAnalysis
  /** Always true here: no separation ran, so this is not examiner-grade. */
  preflightOnly: true
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Web Audio decodes to planar; the measurement code wants interleaved. */
function toAudioBuffer32(decoded: AudioBuffer): AudioBuffer32 {
  const channels = decoded.numberOfChannels
  const length = decoded.length
  const samples = new Float32Array(length * channels)
  for (let ch = 0; ch < channels; ch += 1) {
    const data = decoded.getChannelData(ch)
    for (let i = 0; i < length; i += 1) samples[i * channels + ch] = data[i]!
  }
  return {
    sampleRate: decoded.sampleRate,
    channels,
    samples,
    length,
    bitDepth: 32,
    format: 'float32',
  }
}

/**
 * Map the container measurements onto the examiner's feature vocabulary.
 *
 * Only the features a whole mix can honestly answer are passed through. The
 * scorer ignores anything absent and renormalises the weights it did use, so
 * omitting a feature costs confidence rather than inventing a value for it.
 */
function containerFeatures(report: ContainerReport): Record<string, number> {
  const measured: Record<string, number> = {}
  if (Number.isFinite(report.micro_timing_jitter_ms)) {
    measured.micro_timing_std_ms = report.micro_timing_jitter_ms
  }
  if (Number.isFinite(report.hf_phase_correlation)) {
    measured.hf_phase_correlation = report.hf_phase_correlation
  }
  return measured
}

export async function examineFile(file: File): Promise<ExaminerFinding> {
  const bytes = await file.arrayBuffer()
  // Hash the bytes as they arrived, before decoding changes anything.
  const sha256 = await sha256Hex(bytes.slice(0))

  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(bytes.slice(0))
  } finally {
    void ctx.close()
  }

  const audio = toAudioBuffer32(decoded)
  const container = analyseContainer(audio)
  const delivery = evaluateDelivery(container.integrated_lufs, container.true_peak_dbtp)
  const reading = scoreStem('bass_and_harmony', containerFeatures(container), 1)
  const index = authorshipIndex([reading])
  const evidenceWeight = reading.features.reduce((sum, f) => sum + f.weight, 0)

  return {
    fileName: file.name,
    sha256,
    durationSec: audio.length / audio.sampleRate,
    sampleRate: audio.sampleRate,
    channels: audio.channels,
    container,
    delivery,
    clearsDelivery: clearsAllPlatforms(delivery),
    authorshipIndex: index,
    scored: reading.verdict !== 'INDETERMINATE',
    evidenceWeight,
    verdict: overallVerdict(index, [reading]),
    eligibility: claimEligibility(index, [reading]),
    reading,
    preflightOnly: true,
  }
}
