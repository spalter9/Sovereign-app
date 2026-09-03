import { FFT_SIZE, HOP, binFrequencies, meanSpectrum, stft } from './stft'
import {
  coefficientOfVariation,
  detectOnsets,
  estimateTempo,
  findPeaks,
  frameRms,
  hfPhase,
  isSilent,
  lpc,
  lpcFormants,
  median,
  onsetAmplitudes,
  onsetStrength,
  percentile,
  refineOnsets,
  rmsOf,
  toMonoPlanar,
  trackF0,
} from './analysis'

/**
 * The forensic features, per source group.
 *
 * These are ports of the Python worker's extractors and measure the same
 * physical properties: how a real performance wanders in pitch and time, and
 * what a physical recording chain leaves behind that a decoder does not.
 */

export type Measured = Record<string, number | null>

/** Highest frequency still carrying real energy. */
export function spectralCliffHz(mono: Float64Array, sampleRate: number): number | null {
  if (isSilent(mono)) return null
  const spec = stft(mono, sampleRate)
  const spectrum = meanSpectrum(spec)
  const freqs = binFrequencies(sampleRate, spec.bins)

  // Referenced to the 90th percentile of 500 Hz - 8 kHz, not the global peak:
  // one dominant partial would otherwise drag a peak-relative threshold up
  // above the noise floor and report the cliff far too low.
  const reference: number[] = []
  for (let k = 0; k < spec.bins; k += 1) {
    const hz = freqs[k]!
    if (hz >= 500 && hz <= 8000) reference.push(spectrum[k]!)
  }
  if (reference.length === 0) return null
  const ref = percentile(reference, 90)
  if (!(ref > 0)) return null

  const threshold = ref * 10 ** (-40 / 20)
  let last = -1
  for (let k = 0; k < spec.bins; k += 1) if (spectrum[k]! >= threshold) last = k
  return last >= 0 ? freqs[last]! : null
}

/** Mean spectral flatness — geometric over arithmetic mean, per frame. */
export function spectralFlatness(mono: Float64Array, sampleRate: number): number | null {
  if (isSilent(mono)) return null
  const spec = stft(mono, sampleRate)
  if (spec.frames === 0) return null
  const values: number[] = []
  for (let f = 0; f < spec.frames; f += 1) {
    const re = spec.re[f]!
    const im = spec.im[f]!
    let logSum = 0
    let sum = 0
    let count = 0
    for (let k = 1; k < spec.bins; k += 1) {
      const power = re[k]! * re[k]! + im[k]! * im[k]!
      if (power <= 1e-20) continue
      logSum += Math.log(power)
      sum += power
      count += 1
    }
    if (count < 8) continue
    const geometric = Math.exp(logSum / count)
    const arithmetic = sum / count
    if (arithmetic > 0) values.push(geometric / arithmetic)
  }
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * Onset deviation from the nearest 16th-note grid position, in ms.
 *
 * The grid is phase-locked to the first onset so a late count-in is not scored
 * as error. A player lands a few milliseconds either side of the beat; a
 * sequencer lands on it exactly.
 */
export function onsetGridDeviation(
  mono: Float64Array,
  sampleRate: number,
): { deviationMs: number | null; onsets: number[] } {
  if (isSilent(mono)) return { deviationMs: null, onsets: [] }

  const envelope = onsetStrength(stft(mono, sampleRate))
  const tempo = estimateTempo(envelope, sampleRate)
  if (tempo === null || !(tempo > 0)) return { deviationMs: null, onsets: [] }

  const grid = 60 / tempo / 4
  const waitFrames = Math.max(1, Math.round(((grid / 2) * sampleRate) / HOP))
  const coarse = detectOnsets(envelope, sampleRate, waitFrames)
  // Frame resolution is 23 ms; the quantity being measured is single-figure
  // milliseconds, so the onsets are re-found in the waveform before use.
  const onsets = refineOnsets(mono, sampleRate, coarse)
  if (onsets.length < 8) return { deviationMs: null, onsets }

  // A grid taken straight from the tempo estimate is only as good as that
  // estimate: two percent out over sixteen seconds walks the grid a third of
  // a beat, and every onset then reads as wildly early or late regardless of
  // how tightly it was played. So the grid is fitted to the onsets — the
  // spacing and phase that actually minimise deviation are found, and what is
  // reported is the residual against that best fit. That is the quantity the
  // feature is named for: how far off a regular grid the playing sits, not
  // how wrong the tempo estimate was.
  const spread = (candidate: number): number => {
    if (!(candidate > 0)) return Infinity
    const first = onsets[0]!
    const raw = onsets.map((t) => {
      const relative = t - first
      return relative - Math.round(relative / candidate) * candidate
    })
    const mean = raw.reduce((a, b) => a + b, 0) / raw.length
    return Math.sqrt(raw.reduce((a, b) => a + (b - mean) ** 2, 0) / raw.length)
  }

  let bestGrid = grid
  let bestSpread = spread(grid)
  const STEPS = 400
  for (let i = 0; i <= STEPS; i += 1) {
    // +/-25% around the estimate covers tempo error and a half/double mistake
    // in either direction landing on the true subdivision.
    const candidate = grid * (0.75 + (0.5 * i) / STEPS)
    const value = spread(candidate)
    if (value < bestSpread) {
      bestSpread = value
      bestGrid = candidate
    }
  }
  void bestGrid
  return { deviationMs: bestSpread * 1000, onsets }
}

/** Energy still present 50-300 ms after a note offset, relative to the offset. */
function lateFieldRatio(mono: Float64Array, sampleRate: number): number | null {
  const rms = frameRms(mono)
  if (rms.length < 16) return null
  let peak = 0
  for (let i = 0; i < rms.length; i += 1) if (rms[i]! > peak) peak = rms[i]!
  if (!(peak > 0)) return null

  const threshold = peak * 0.4
  const lateStart = Math.max(1, Math.round((0.05 * sampleRate) / HOP))
  const lateEnd = Math.max(lateStart + 1, Math.round((0.3 * sampleRate) / HOP))

  const ratios: number[] = []
  for (let i = 1; i < rms.length - lateEnd; i += 1) {
    // An offset is where the level falls back through the threshold.
    if (rms[i]! < threshold && rms[i - 1]! >= threshold) {
      const reference = rms[i - 1]!
      if (!(reference > 0)) continue
      let sum = 0
      let count = 0
      let highest = 0
      for (let j = i + lateStart; j < i + lateEnd && j < rms.length; j += 1) {
        sum += rms[j]!
        if (rms[j]! > highest) highest = rms[j]!
        count += 1
      }
      // A new note inside the decay window is not the old note's room tail.
      // Without this the measurement reports the next entry and every source
      // looks like it was recorded in a cathedral.
      if (count > 0 && highest <= reference) ratios.push(sum / count / reference)
    }
  }
  if (ratios.length === 0) return null
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length
  return Math.min(Math.max(mean, 0), 1)
}

/**
 * Contiguous runs of one sustained note, at least `minFrames` long.
 *
 * Voicing alone does not bound a note: a legato phrase is voiced straight
 * through several pitches, and detrending across that measures the melody
 * rather than the wobble inside a note. A jump of more than a semitone ends
 * the segment, so what comes back is a held note and not a phrase.
 */
function sustainedSegments(
  voiced: Uint8Array,
  f0: Float64Array,
  minFrames: number,
): [number, number][] {
  const SEMITONE_CENTS = 100
  const segments: [number, number][] = []
  let start = -1

  const close = (end: number) => {
    if (start >= 0 && end - start >= minFrames) segments.push([start, end])
    start = -1
  }

  for (let i = 0; i < voiced.length; i += 1) {
    if (!voiced[i] || !Number.isFinite(f0[i]!)) {
      close(i)
      continue
    }
    if (start < 0) {
      start = i
      continue
    }
    const previous = f0[i - 1]!
    if (Number.isFinite(previous) && previous > 0 && f0[i]! > 0) {
      const jump = Math.abs(1200 * Math.log2(f0[i]! / previous))
      if (jump > SEMITONE_CENTS) {
        close(i)
        start = i
      }
    }
  }
  close(voiced.length)
  return segments
}

export function vocalFeatures(channels: Float64Array[], sampleRate: number): Measured {
  const mono = toMonoPlanar(channels)
  const { coherence, dispersion } = hfPhase(channels, sampleRate)

  const features: Measured = {
    hf_phase_dispersion: dispersion,
    hf_phase_correlation: coherence,
    pitch_jitter_pct: null,
    micro_pitch_drift_cents: null,
    shimmer_pct: null,
    formant_stability_cv: null,
    room_late_energy_ratio: null,
    voiced_ratio: null,
  }
  if (isSilent(mono)) return features

  // C2 to C7 — the range a sung human voice occupies.
  const { f0, voiced } = trackF0(mono, sampleRate, 65.41, 2093.0)
  let voicedCount = 0
  for (let i = 0; i < voiced.length; i += 1) voicedCount += voiced[i]!
  features.voiced_ratio = voiced.length > 0 ? voicedCount / voiced.length : null

  const validIdx: number[] = []
  for (let i = 0; i < f0.length; i += 1) if (voiced[i] && Number.isFinite(f0[i]!)) validIdx.push(i)

  if (validIdx.length >= 12) {
    // Jitter: cycle-to-cycle period perturbation.
    const periods = validIdx.map((i) => 1 / f0[i]!)
    const deltas: number[] = []
    for (let i = 1; i < periods.length; i += 1) deltas.push(Math.abs(periods[i]! - periods[i - 1]!))
    const meanPeriod = periods.reduce((a, b) => a + b, 0) / periods.length
    if (meanPeriod > 0 && deltas.length > 0) {
      features.pitch_jitter_pct =
        (deltas.reduce((a, b) => a + b, 0) / deltas.length / meanPeriod) * 100
    }

    // Micro-pitch drift: detrended cents deviation inside sustained notes.
    const minFrames = Math.max(4, Math.round((0.2 * sampleRate) / HOP))
    const drifts: number[] = []
    for (const [start, end] of sustainedSegments(voiced, f0, minFrames)) {
      const segment: number[] = []
      for (let i = start; i < end; i += 1) if (Number.isFinite(f0[i]!)) segment.push(f0[i]!)
      if (segment.length < 4) continue
      const centre = median(segment)
      if (!(centre > 0)) continue
      const cents = segment.map((v) => 1200 * Math.log2(v / centre))
      // Remove the linear trend: a slide is intent, the wobble around it is
      // the physical signature being measured.
      const n = cents.length
      let sx = 0
      let sy = 0
      let sxx = 0
      let sxy = 0
      for (let i = 0; i < n; i += 1) {
        sx += i
        sy += cents[i]!
        sxx += i * i
        sxy += i * cents[i]!
      }
      const denom = n * sxx - sx * sx
      const slope = Math.abs(denom) > 1e-12 ? (n * sxy - sx * sy) / denom : 0
      const intercept = (sy - slope * sx) / n
      let acc = 0
      for (let i = 0; i < n; i += 1) acc += (cents[i]! - (slope * i + intercept)) ** 2
      drifts.push(Math.sqrt(acc / n))
    }
    if (drifts.length > 0) {
      features.micro_pitch_drift_cents = drifts.reduce((a, b) => a + b, 0) / drifts.length
    }

    // Shimmer: perturbation between successive glottal-period peak amplitudes.
    const medianF0 = median(validIdx.map((i) => f0[i]!))
    if (Number.isFinite(medianF0) && medianF0 > 0) {
      const distance = Math.max(2, Math.round((sampleRate / medianF0) * 0.8))
      const peaks = findPeaks(mono, distance)
      if (peaks.length >= 12) {
        const amps = peaks.map((i) => Math.abs(mono[i]!))
        const meanAmp = amps.reduce((a, b) => a + b, 0) / amps.length
        if (meanAmp > 0) {
          const diffs: number[] = []
          for (let i = 1; i < amps.length; i += 1) diffs.push(Math.abs(amps[i]! - amps[i - 1]!))
          features.shimmer_pct =
            (diffs.reduce((a, b) => a + b, 0) / diffs.length / meanAmp) * 100
        }
      }
    }
  }

  // Formant trajectories over voiced frames.
  const order = Math.round(2 + sampleRate / 1000)
  const f1: number[] = []
  const f2: number[] = []
  for (let index = 0; index < voiced.length; index += 1) {
    if (!voiced[index]) continue
    const start = index * HOP
    if (start + FFT_SIZE > mono.length) continue
    const segment = mono.slice(start, start + FFT_SIZE)
    if (rmsOf(segment) < 1e-5) continue
    // Hamming, as the reference does.
    for (let i = 0; i < segment.length; i += 1) {
      segment[i] = segment[i]! * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (segment.length - 1)))
    }
    const coeffs = lpc(segment, order)
    if (!coeffs) continue
    const formants = lpcFormants(coeffs, sampleRate)
    if (formants.length >= 2) {
      f1.push(formants[0]!)
      f2.push(formants[1]!)
    }
  }
  if (f1.length >= 8) {
    const cv1 = coefficientOfVariation(f1)
    const cv2 = coefficientOfVariation(f2)
    const values = [cv1, cv2].filter((v): v is number => v !== null)
    if (values.length > 0) {
      features.formant_stability_cv = values.reduce((a, b) => a + b, 0) / values.length
    }
  }

  features.room_late_energy_ratio = lateFieldRatio(mono, sampleRate)
  return features
}

export function drumFeatures(channels: Float64Array[], sampleRate: number): Measured {
  const mono = toMonoPlanar(channels)
  const { coherence } = hfPhase(channels, sampleRate)

  const features: Measured = {
    hf_phase_correlation: coherence,
    onset_jitter_ms: null,
    transient_crest_db: null,
    spectral_cliff_hz: spectralCliffHz(mono, sampleRate),
    velocity_variance_cv: null,
  }
  if (isSilent(mono)) return features

  const { deviationMs, onsets } = onsetGridDeviation(mono, sampleRate)
  features.onset_jitter_ms = deviationMs

  const amps = onsetAmplitudes(mono, sampleRate, onsets)
  features.velocity_variance_cv = amps.length > 0 ? coefficientOfVariation(amps) : null

  // Crest measured locally around each hit: a stem-wide figure would only
  // report how sparse the part is.
  if (onsets.length > 0) {
    const window = Math.round(0.05 * sampleRate)
    const crests: number[] = []
    for (const time of onsets) {
      const start = Math.round(time * sampleRate)
      const segment = mono.slice(start, Math.min(start + window, mono.length))
      if (segment.length < 32) continue
      const rms = rmsOf(segment)
      let peak = 0
      for (let i = 0; i < segment.length; i += 1) {
        const v = Math.abs(segment[i]!)
        if (v > peak) peak = v
      }
      if (rms > 0 && peak > 0) crests.push(20 * Math.log10(peak / rms))
    }
    if (crests.length > 0) {
      features.transient_crest_db = crests.reduce((a, b) => a + b, 0) / crests.length
    }
  }

  return features
}

export function harmonyFeatures(channels: Float64Array[], sampleRate: number): Measured {
  const mono = toMonoPlanar(channels)
  const { coherence } = hfPhase(channels, sampleRate)

  const features: Measured = {
    hf_phase_correlation: coherence,
    micro_timing_std_ms: null,
    note_duration_cv: null,
    harmonic_drift_cents: null,
    spectral_flatness: null,
  }
  if (isSilent(mono)) return features

  const { deviationMs, onsets } = onsetGridDeviation(mono, sampleRate)
  features.micro_timing_std_ms = deviationMs
  features.spectral_flatness = spectralFlatness(mono, sampleRate)

  // Note durations: onset to the point the note has decayed 20 dB.
  if (onsets.length >= 4) {
    const rms = frameRms(mono)
    const durations: number[] = []
    for (const time of onsets) {
      const frame = Math.round((time * sampleRate) / HOP)
      if (frame >= rms.length - 2) continue
      const startLevel = rms[frame]!
      if (!(startLevel > 0)) continue
      const target = startLevel * 10 ** (-20 / 20)
      let end = frame + 1
      while (end < rms.length && rms[end]! > target) end += 1
      durations.push(((end - frame) * HOP) / sampleRate)
    }
    if (durations.length >= 4) features.note_duration_cv = coefficientOfVariation(durations)
  }

  // Intonation drift: deviation from equal temperament inside held notes.
  const { f0, voiced } = trackF0(mono, sampleRate, 32.7, 1046.5)
  const valid: number[] = []
  for (let i = 0; i < f0.length; i += 1) if (voiced[i] && Number.isFinite(f0[i]!)) valid.push(f0[i]!)
  if (valid.length >= 12) {
    const deviations = valid.map((hz) => {
      const cents = 1200 * Math.log2(hz / 440)
      return cents - Math.round(cents / 100) * 100
    })
    const mean = deviations.reduce((a, b) => a + b, 0) / deviations.length
    const variance = deviations.reduce((a, b) => a + (b - mean) ** 2, 0) / deviations.length
    features.harmonic_drift_cents = Math.sqrt(variance)
  }

  return features
}

export const FEATURE_EXTRACTORS = {
  vocals: vocalFeatures,
  drums: drumFeatures,
  bass: harmonyFeatures,
  other: harmonyFeatures,
} as const
