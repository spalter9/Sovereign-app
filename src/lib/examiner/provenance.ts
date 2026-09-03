import { FFT_SIZE, binFrequencies, stft } from './stft'
import { frameRms, percentile, toMonoPlanar } from './analysis'

/**
 * Noise-floor colour — the one signal shown to separate generated audio from
 * recorded audio on real material.
 *
 * Everything the examiner measures about *performance* — timing spread,
 * intonation drift, room tail — failed on real tracks: a modern generative
 * model reproduces all of it, because it was trained on recordings that have
 * it. Tested against eight tracks of known provenance, not one of those
 * features separated the two classes.
 *
 * What does separate is what sits underneath the music in its quietest
 * moments. On 32 excerpts from 8 tracks of known provenance the recorded
 * material's noise floor fell away at about -0.93 on log-log axes and the
 * generated material's at about -0.49.
 *
 * Note which way round that is. Measured on the amplitude spectrum, true pink
 * noise has a slope of -0.5 — so it is the *generated* floors that are
 * near-pink, and the recorded ones that fall off considerably faster. That is
 * consistent with a physical chain: a room absorbs high frequencies, and mic,
 * preamp and mastering all roll off the top further, leaving a floor steeper
 * than any idealised noise colour. A decoder's quiet passages carry
 * reconstruction residual that is spread far more evenly across the band.
 *
 * A lead, not a proven detector. Eight tracks is a small sample, four
 * excerpts from one track are not four independent pieces of evidence, and
 * the two groups may differ in ways other than provenance — studio, mastering
 * chain and era all touch the noise floor too. It is reported with that
 * uncertainty attached rather than folded silently into a verdict.
 */

export type FloorReading = {
  /** Log-log slope of the noise floor, 200 Hz - 16 kHz. Near -1 is pink. */
  slope: number | null
  /** Geometric over arithmetic mean of the floor. Higher is flatter. */
  flatness: number | null
  /** Mean level of the floor, dBFS. */
  levelDb: number | null
  /** How many frames were quiet enough to measure. */
  framesUsed: number
}

const LOW_HZ = 200
const HIGH_HZ = 16000

export function measureNoiseFloor(
  channels: Float64Array[],
  sampleRate: number,
): FloorReading {
  return measureNoiseFloorBand(channels, sampleRate, LOW_HZ, HIGH_HZ)
}

/** The same measurement over an arbitrary band, for the sub-band features. */
export function measureNoiseFloorBand(
  channels: Float64Array[],
  sampleRate: number,
  lowHz: number,
  highHz: number,
): FloorReading {
  const empty: FloorReading = { slope: null, flatness: null, levelDb: null, framesUsed: 0 }
  const mono = toMonoPlanar(channels)
  if (mono.length < FFT_SIZE * 4) return empty

  const spec = stft(mono, sampleRate)
  if (spec.frames < 8) return empty
  const freqs = binFrequencies(sampleRate, spec.bins)
  const rms = frameRms(mono)

  // The quietest twentieth of the programme: where the music is out of the
  // way and whatever underlies it is audible.
  const usable = Math.min(rms.length, spec.frames)
  const threshold = percentile(Array.from(rms.slice(0, usable)), 5)
  const quiet: number[] = []
  for (let f = 0; f < usable; f += 1) if (rms[f]! <= Math.max(threshold, 1e-9)) quiet.push(f)
  if (quiet.length < 4) return empty

  const floor = new Float64Array(spec.bins)
  for (const f of quiet) {
    const re = spec.re[f]!
    const im = spec.im[f]!
    for (let k = 0; k < spec.bins; k += 1) floor[k] += Math.hypot(re[k]!, im[k]!)
  }
  for (let k = 0; k < spec.bins; k += 1) floor[k] = floor[k]! / quiet.length + 1e-12

  const logF: number[] = []
  const logA: number[] = []
  let sum = 0
  let logSum = 0
  let count = 0
  for (let k = 0; k < spec.bins; k += 1) {
    const hz = freqs[k]!
    if (hz < lowHz || hz > highHz) continue
    logF.push(Math.log10(hz))
    logA.push(Math.log10(floor[k]!))
    sum += floor[k]!
    logSum += Math.log(floor[k]!)
    count += 1
  }
  if (count < 16) return empty

  // Least-squares slope through the floor in log-log space.
  const n = logF.length
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i += 1) {
    sx += logF[i]!
    sy += logA[i]!
    sxx += logF[i]! * logF[i]!
    sxy += logF[i]! * logA[i]!
  }
  const denom = n * sxx - sx * sx
  const slope = Math.abs(denom) > 1e-12 ? (n * sxy - sx * sy) / denom : null

  const geometric = Math.exp(logSum / count)
  const arithmetic = sum / count
  const flatness = arithmetic > 0 ? geometric / arithmetic : null

  let level = 0
  for (let k = 0; k < spec.bins; k += 1) level += floor[k]!
  level /= spec.bins

  // Digital silence has no floor to colour. Left ungated it fits a flat line
  // through the epsilon added above and reports "generated" with total
  // confidence, which is the worst possible answer to give about an empty
  // file.
  const levelDb = level > 0 ? 20 * Math.log10(level) : null
  if (levelDb === null || levelDb < -110) {
    return { slope: null, flatness: null, levelDb, framesUsed: 0 }
  }

  return {
    slope,
    flatness,
    levelDb,
    framesUsed: quiet.length,
  }
}

export type FloorVerdict = {
  reading: FloorReading
  /** Which population the floor resembles. */
  resembles: 'recorded' | 'generated' | 'inconclusive'
  /** Plain-language reading of the measurement. */
  note: string
}

/**
 * Boundaries taken from the observed populations, with margin on both sides.
 *
 * Across 32 excerpts of known provenance no recorded excerpt read flatter
 * than -0.60 and no generated one read steeper than -0.89. The bands sit
 * outside both of those, leaving everything between them explicitly
 * inconclusive rather than guessed: on a tool that informs a copyright
 * filing, "I cannot tell" is a far cheaper error than telling a writer their
 * own recording was machine-made.
 *
 * Provisional either way — eight tracks is a small sample and excerpts from
 * one track are not independent evidence.
 */
const PINK_SIDE = -0.9
const FLAT_SIDE = -0.55

export function readNoiseFloor(reading: FloorReading): FloorVerdict {
  const s = reading.slope
  if (s === null || reading.framesUsed < 4) {
    return {
      reading,
      resembles: 'inconclusive',
      note: 'No passage was quiet enough to read a noise floor.',
    }
  }
  if (s <= PINK_SIDE) {
    return {
      reading,
      resembles: 'recorded',
      note: `Noise floor falls away at ${s.toFixed(2)} on log-log — steeply, the way a floor does after a room, a microphone and a mastering chain have each taken energy off the top.`,
    }
  }
  if (s >= FLAT_SIDE) {
    return {
      reading,
      resembles: 'generated',
      note: `Noise floor falls at only ${s.toFixed(2)} on log-log — spread far more evenly across the band than a physical capture leaves it, which is what reconstruction residual looks like.`,
    }
  }
  return {
    reading,
    resembles: 'inconclusive',
    note: `Noise floor slope ${s.toFixed(2)} sits between the two populations observed so far; this reading does not favour either.`,
  }
}


/* ── the classifier ──────────────────────────────────────────────────────
 *
 * Three measurements, combined by a logistic model fitted on eight tracks of
 * known provenance and validated by holding each track out in turn.
 *
 * Holding out whole tracks matters. Six excerpts from one song are not six
 * independent pieces of evidence, and scoring by pooling them overstates the
 * result — the noise-floor slope alone looked like 91.7% pooled and is 83.3%
 * once whole tracks are held out. The three together reach 89.6% per excerpt,
 * and every one of the eight tracks landed on the correct side when it was
 * the held-out one.
 *
 * What the three measure:
 *
 * - floorSlopeAll: colour of the noise floor across 200 Hz - 16 kHz. A
 *   recorded floor falls away steeply; a decoder's residual is spread evenly.
 * - specFluxSd: how much the frame-to-frame spectral change itself varies.
 *   Playing pushes energy around unevenly; generation is smoother.
 * - floorSlopeHi: the same floor colour restricted to 8-16 kHz, where a
 *   physical chain's rolloff and a decoder's residual differ most.
 */

const MODEL = {
  mean: [-0.69323, 0.969837, -2.00889],
  sd: [0.298874, 0.108795, 0.809802],
  weights: [1.80908, -1.579806, 0.79761],
  bias: 0.115706,
} as const

export type ProvenanceScore = {
  /** Probability the excerpt came from a generative model, 0-1. */
  pGenerated: number
  floorSlopeAll: number | null
  floorSlopeHi: number | null
  specFluxSd: number | null
  /** False when a measurement was missing and no score could be formed. */
  scored: boolean
}

/** Variability of frame-to-frame spectral change. */
export function spectralFluxSd(channels: Float64Array[], sampleRate: number): number | null {
  const mono = toMonoPlanar(channels)
  if (mono.length < FFT_SIZE * 4) return null
  const spec = stft(mono, sampleRate)
  if (spec.frames < 8) return null

  let sum = 0
  let sumSq = 0
  let n = 0
  for (let f = 1; f < spec.frames; f += 1) {
    const re = spec.re[f]!
    const im = spec.im[f]!
    const pre = spec.re[f - 1]!
    const pim = spec.im[f - 1]!
    for (let k = 0; k < spec.bins; k += 1) {
      const now = Math.log(Math.hypot(re[k]!, im[k]!) + 1e-12)
      const was = Math.log(Math.hypot(pre[k]!, pim[k]!) + 1e-12)
      const d = now - was
      sum += d
      sumSq += d * d
      n += 1
    }
  }
  if (n < 64) return null
  const mean = sum / n
  return Math.sqrt(Math.max(0, sumSq / n - mean * mean))
}

/** Noise-floor slope restricted to a band. */
function floorSlopeIn(
  channels: Float64Array[],
  sampleRate: number,
  lowHz: number,
  highHz: number,
): number | null {
  const reading = measureNoiseFloorBand(channels, sampleRate, lowHz, highHz)
  return reading.slope
}

export function scoreProvenance(
  channels: Float64Array[],
  sampleRate: number,
): ProvenanceScore {
  const floorSlopeAll = floorSlopeIn(channels, sampleRate, 200, 16000)
  const floorSlopeHi = floorSlopeIn(channels, sampleRate, 8000, 16000)
  const specFluxSd = spectralFluxSd(channels, sampleRate)

  const values = [floorSlopeAll, specFluxSd, floorSlopeHi]
  if (values.some((v) => v === null || !Number.isFinite(v))) {
    return { pGenerated: 0.5, floorSlopeAll, floorSlopeHi, specFluxSd, scored: false }
  }

  let z = MODEL.bias
  for (let i = 0; i < 3; i += 1) {
    z += MODEL.weights[i]! * ((values[i] as number) - MODEL.mean[i]!) / MODEL.sd[i]!
  }
  return {
    pGenerated: 1 / (1 + Math.exp(-z)),
    floorSlopeAll,
    floorSlopeHi,
    specFluxSd,
    scored: true,
  }
}


export type TrackProvenance = {
  /** Mean probability across excerpts. */
  pGenerated: number
  excerpts: number[]
  resembles: 'recorded' | 'generated' | 'inconclusive'
  note: string
  detail: ProvenanceScore | null
}

/**
 * Score a whole track by sampling excerpts across it.
 *
 * One thirty-second window is noisier than the record it came from — an intro,
 * a breakdown or a solo passage can each read atypically. Sampling across the
 * running time and averaging is what took the eight validation tracks from
 * 89.6% per excerpt to eight out of eight per track.
 */
export function scoreTrackProvenance(
  channels: Float64Array[],
  sampleRate: number,
): TrackProvenance {
  const frames = channels[0]?.length ?? 0
  const window = Math.round(30 * sampleRate)
  const scores: number[] = []
  let last: ProvenanceScore | null = null

  if (frames >= window) {
    for (let i = 0; i < 6; i += 1) {
      const start = Math.round((0.06 + 0.14 * i) * frames)
      if (start + window > frames) break
      const slice = channels.map((ch) => ch.slice(start, start + window))
      const s = scoreProvenance(slice, sampleRate)
      if (s.scored) {
        scores.push(s.pGenerated)
        last = s
      }
    }
  }
  // Too short to excerpt: score what there is rather than refusing outright.
  if (scores.length === 0) {
    const s = scoreProvenance(channels, sampleRate)
    if (s.scored) {
      scores.push(s.pGenerated)
      last = s
    }
  }

  if (scores.length === 0) {
    return {
      pGenerated: 0.5,
      excerpts: [],
      resembles: 'inconclusive',
      note: 'Too little usable audio to measure provenance.',
      detail: null,
    }
  }

  const p = scores.reduce((a, b) => a + b, 0) / scores.length

  /*
   * A margin either side of even odds is left explicitly undecided.
   *
   * The model was fitted on eight tracks. Its ordering held when each was
   * held out in turn, but a probability near a half is the model saying it
   * cannot tell, and dressing that up as a verdict is how a tool ends up
   * confidently wrong in front of someone who acted on it.
   */
  const resembles = p >= 0.65 ? 'generated' : p <= 0.35 ? 'recorded' : 'inconclusive'
  const pct = (p * 100).toFixed(0)
  const note =
    resembles === 'generated'
      ? `Across ${scores.length} passages the recording measures ${pct}% toward generated: the noise floor is spread more evenly than a physical capture leaves it, and the spectrum changes more smoothly than playing does.`
      : resembles === 'recorded'
        ? `Across ${scores.length} passages the recording measures ${100 - Number(pct)}% toward captured: the noise floor falls away steeply, the way it does after a room, a microphone and a mastering chain.`
        : `Across ${scores.length} passages the measurements sit near even (${pct}% toward generated) and do not favour either origin.`

  return { pGenerated: p, excerpts: scores, resembles, note, detail: last }
}
