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
    if (hz < LOW_HZ || hz > HIGH_HZ) continue
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
