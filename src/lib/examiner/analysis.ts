import { FFT_SIZE, HOP, SILENCE_RMS, binFrequencies, stft, type Spectrogram } from './stft'

/**
 * Analysis primitives the feature extractors are built from.
 *
 * These stand in for the librosa calls the Python worker makes. Where an exact
 * equivalent was impractical in the browser the substitute is named in the
 * comment and chosen to measure the same physical property, because a feature
 * that means something different here than it does on the host would quietly
 * make the two implementations disagree about the same file.
 */

export function toMonoPlanar(channels: Float64Array[]): Float64Array {
  const n = channels[0]?.length ?? 0
  const mono = new Float64Array(n)
  if (channels.length === 0) return mono
  for (const ch of channels) for (let i = 0; i < n; i += 1) mono[i] += ch[i]!
  for (let i = 0; i < n; i += 1) mono[i] /= channels.length
  return mono
}

export function rmsOf(signal: Float64Array): number {
  if (signal.length === 0) return 0
  let sum = 0
  for (let i = 0; i < signal.length; i += 1) sum += signal[i]! * signal[i]!
  return Math.sqrt(sum / signal.length)
}

export function isSilent(signal: Float64Array): boolean {
  return rmsOf(signal) < SILENCE_RMS
}

/** Coefficient of variation, or null when it is not defined. */
export function coefficientOfVariation(values: number[]): number | null {
  if (values.length < 2) return null
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (!Number.isFinite(mean) || Math.abs(mean) < 1e-12) return null
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.sqrt(variance) / Math.abs(mean)
}

export function median(values: number[]): number {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

export function percentile(values: Float64Array | number[], p: number): number {
  const arr = Array.from(values).sort((a, b) => a - b)
  if (arr.length === 0) return Number.NaN
  const idx = (p / 100) * (arr.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return arr[lo]!
  return arr[lo]! + (arr[hi]! - arr[lo]!) * (idx - lo)
}

/** Frame-wise RMS on the STFT grid, so it aligns with every other feature. */
export function frameRms(signal: Float64Array): Float64Array {
  const frames = signal.length < FFT_SIZE ? 1 : 1 + Math.floor((signal.length - FFT_SIZE) / HOP)
  const out = new Float64Array(frames)
  for (let f = 0; f < frames; f += 1) {
    const start = f * HOP
    let sum = 0
    let count = 0
    for (let n = 0; n < FFT_SIZE; n += 1) {
      const s = start + n
      if (s >= signal.length) break
      sum += signal[s]! * signal[s]!
      count += 1
    }
    out[f] = count > 0 ? Math.sqrt(sum / count) : 0
  }
  return out
}

/**
 * Onset strength: half-wave-rectified spectral flux.
 *
 * This is what librosa.onset.onset_strength computes, and it is what makes a
 * struck note visible as a rise in broadband energy.
 */
export function onsetStrength(spec: Spectrogram): Float64Array {
  const flux = new Float64Array(spec.frames)
  let previous: Float64Array | null = null
  for (let f = 0; f < spec.frames; f += 1) {
    const re = spec.re[f]!
    const im = spec.im[f]!
    const mag = new Float64Array(spec.bins)
    for (let k = 0; k < spec.bins; k += 1) mag[k] = Math.hypot(re[k]!, im[k]!)
    if (previous) {
      let sum = 0
      for (let k = 0; k < spec.bins; k += 1) {
        const diff = mag[k]! - previous[k]!
        if (diff > 0) sum += diff
      }
      flux[f] = sum
    }
    previous = mag
  }
  return flux
}

/**
 * Tempo from the autocorrelation of the onset envelope.
 *
 * librosa runs a full beat tracker; the periodicity of the envelope is what
 * that tracker is reading, and it is what the grid needs. Searched over
 * 50-200 BPM, which brackets essentially all released music.
 */
export function estimateTempo(envelope: Float64Array, sampleRate: number): number | null {
  if (envelope.length < 16) return null
  const mean = envelope.reduce((a, b) => a + b, 0) / envelope.length
  const centred = Float64Array.from(envelope, (v) => v - mean)

  const framesPerSecond = sampleRate / HOP
  const minLag = Math.max(1, Math.round((60 / 200) * framesPerSecond))
  const maxLag = Math.min(centred.length - 1, Math.round((60 / 50) * framesPerSecond))
  if (maxLag <= minLag) return null

  // Autocorrelation peaks just as hard at twice the true period, so a plain
  // argmax reports half the tempo about as often as it reports the tempo.
  // Weighting by a log-normal prior around 120 BPM — the same correction
  // librosa's tempo estimator applies — breaks that tie the way a listener
  // does, toward the pulse they would tap.
  const scores = new Float64Array(maxLag + 1)
  let bestLag = -1
  let bestScore = -Infinity
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0
    for (let i = 0; i + lag < centred.length; i += 1) sum += centred[i]! * centred[i + lag]!
    const raw = sum / (centred.length - lag)
    const bpm = 60 / (lag / framesPerSecond)
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 1.0) ** 2)
    const score = raw * prior
    scores[lag] = score
    if (score > bestScore) {
      bestScore = score
      bestLag = lag
    }
  }
  if (bestLag <= 0 || bestScore <= 0) return null

  // Even with the prior, a strong subharmonic can win. If half the chosen lag
  // also carries real periodicity, the faster pulse is the real one.
  const half = Math.round(bestLag / 2)
  if (half >= minLag && scores[half]! > bestScore * 0.5) bestLag = half

  return 60 / (bestLag / framesPerSecond)
}

/**
 * Peak-pick the onset envelope into onset times, in seconds.
 *
 * `waitFrames` enforces a minimum spacing: sustained, pitch-modulated material
 * ripples the envelope inside one held note, and without a floor on spacing
 * that ripple reads as a run of extra notes.
 */
export function detectOnsets(
  envelope: Float64Array,
  sampleRate: number,
  waitFrames: number,
): number[] {
  if (envelope.length < 4) return []
  const mean = envelope.reduce((a, b) => a + b, 0) / envelope.length
  const peak = Math.max(...envelope)
  if (peak <= 0) return []
  const threshold = mean + 0.3 * (peak - mean)

  const onsets: number[] = []
  let lastFrame = -Infinity
  for (let f = 1; f < envelope.length - 1; f += 1) {
    const v = envelope[f]!
    if (v < threshold) continue
    if (v < envelope[f - 1]! || v < envelope[f + 1]!) continue
    if (f - lastFrame < waitFrames) continue
    // Backtrack to the local minimum before the peak, which is where the
    // note actually starts rather than where it is loudest.
    let start = f
    while (start > 0 && envelope[start - 1]! < envelope[start]!) start -= 1
    onsets.push((start * HOP) / sampleRate)
    lastFrame = f
  }
  return onsets
}

/** Peak amplitude in a 60 ms window after each onset. */
export function onsetAmplitudes(
  mono: Float64Array,
  sampleRate: number,
  onsets: number[],
): number[] {
  const window = Math.round(0.06 * sampleRate)
  const peaks: number[] = []
  for (const time of onsets) {
    const start = Math.round(time * sampleRate)
    let peak = 0
    for (let i = start; i < Math.min(start + window, mono.length); i += 1) {
      const v = Math.abs(mono[i]!)
      if (v > peak) peak = v
    }
    if (peak > 0) peaks.push(peak)
  }
  return peaks
}

/**
 * Fundamental frequency per frame by the YIN difference function.
 *
 * librosa uses pyin, which is YIN plus an HMM over candidate pitches. The
 * difference function and the cumulative-mean normalisation below are YIN's
 * core and give the same estimate on clearly-voiced frames; what is given up
 * is the HMM's smoothing across ambiguous ones, so the voiced test here is
 * deliberately strict rather than permissive.
 */
export function trackF0(
  mono: Float64Array,
  sampleRate: number,
  fmin: number,
  fmax: number,
): { f0: Float64Array; voiced: Uint8Array } {
  const frames = mono.length < FFT_SIZE ? 1 : 1 + Math.floor((mono.length - FFT_SIZE) / HOP)
  const f0 = new Float64Array(frames).fill(Number.NaN)
  const voiced = new Uint8Array(frames)

  const minLag = Math.max(2, Math.floor(sampleRate / fmax))
  const maxLag = Math.min(Math.floor(sampleRate / fmin), FFT_SIZE - 1)
  if (maxLag <= minLag) return { f0, voiced }

  const diff = new Float64Array(maxLag + 1)
  const cmnd = new Float64Array(maxLag + 1)

  for (let f = 0; f < frames; f += 1) {
    const start = f * HOP
    const end = Math.min(start + FFT_SIZE, mono.length)
    const size = end - start
    if (size < maxLag * 2) continue

    let energy = 0
    for (let i = start; i < end; i += 1) energy += mono[i]! * mono[i]!
    if (Math.sqrt(energy / size) < SILENCE_RMS) continue

    // Difference function.
    diff.fill(0)
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let sum = 0
      const limit = size - lag
      for (let i = 0; i < limit; i += 1) {
        const d = mono[start + i]! - mono[start + i + lag]!
        sum += d * d
      }
      diff[lag] = sum
    }

    // Cumulative mean normalised difference — YIN step 3.
    cmnd[0] = 1
    let running = 0
    for (let lag = 1; lag <= maxLag; lag += 1) {
      running += diff[lag]!
      cmnd[lag] = running > 0 ? (diff[lag]! * lag) / running : 1
    }

    // First minimum below the absolute threshold, else the global minimum.
    const THRESHOLD = 0.15
    let chosen = -1
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      if (cmnd[lag]! < THRESHOLD) {
        let best = lag
        while (best + 1 <= maxLag && cmnd[best + 1]! < cmnd[best]!) best += 1
        chosen = best
        break
      }
    }
    if (chosen < 0) continue

    // Parabolic interpolation around the minimum for sub-sample precision —
    // without it the pitch quantises to integer lags and reads as drift that
    // is not in the signal.
    let refined = chosen
    if (chosen > minLag && chosen < maxLag) {
      const a = cmnd[chosen - 1]!
      const b = cmnd[chosen]!
      const c = cmnd[chosen + 1]!
      const denom = 2 * (2 * b - a - c)
      if (Math.abs(denom) > 1e-12) refined = chosen + (a - c) / denom
    }
    if (refined <= 0) continue

    const hz = sampleRate / refined
    if (hz >= fmin && hz <= fmax) {
      f0[f] = hz
      voiced[f] = 1
    }
  }

  return { f0, voiced }
}

/** Linear prediction coefficients by Levinson-Durbin. Null if ill-conditioned. */
export function lpc(frame: Float64Array, order: number): Float64Array | null {
  const r = new Float64Array(order + 1)
  for (let lag = 0; lag <= order; lag += 1) {
    let sum = 0
    for (let i = 0; i + lag < frame.length; i += 1) sum += frame[i]! * frame[i + lag]!
    r[lag] = sum
  }
  if (!(r[0]! > 0) || !Number.isFinite(r[0]!)) return null

  const a = new Float64Array(order + 1)
  a[0] = 1
  let error = r[0]!

  for (let i = 1; i <= order; i += 1) {
    let acc = r[i]!
    for (let j = 1; j < i; j += 1) acc += a[j]! * r[i - j]!
    const k = -acc / error
    if (!Number.isFinite(k)) return null

    const prev = a.slice(0, i)
    for (let j = 1; j < i; j += 1) a[j] = prev[j]! + k * prev[i - j]!
    a[i] = k
    error *= 1 - k * k
    if (!(error > 0) || !Number.isFinite(error)) return null
  }

  for (let i = 0; i <= order; i += 1) if (!Number.isFinite(a[i]!)) return null
  return a
}

/**
 * Formant frequencies from the LPC spectral envelope.
 *
 * The reference implementation factors the LPC polynomial and reads the
 * angles of its roots. At the order a 44.1 kHz frame needs (~46) that
 * factorisation is badly conditioned — the roots crowd the unit circle and
 * the iteration underflows on the product of their differences — so this
 * evaluates the envelope 1/|A(e^-jw)| on a frequency grid and picks its peaks
 * instead. Same quantity, read off the curve the roots would have shaped,
 * without asking a root finder for precision it cannot deliver here.
 */
export function lpcFormants(
  coeffs: Float64Array,
  sampleRate: number,
  maxHz = 5000,
): number[] {
  const STEP_HZ = 5
  const points = Math.floor(maxHz / STEP_HZ) + 1
  const envelope = new Float64Array(points)

  for (let i = 0; i < points; i += 1) {
    const hz = i * STEP_HZ
    const w = (2 * Math.PI * hz) / sampleRate
    // A(e^-jw) = sum a_k e^-jwk
    let re = 0
    let im = 0
    for (let k = 0; k < coeffs.length; k += 1) {
      re += coeffs[k]! * Math.cos(w * k)
      im -= coeffs[k]! * Math.sin(w * k)
    }
    const mag = Math.hypot(re, im)
    envelope[i] = mag > 1e-18 ? 1 / mag : 0
  }

  const peaks: number[] = []
  for (let i = 1; i < points - 1; i += 1) {
    if (envelope[i]! > envelope[i - 1]! && envelope[i]! >= envelope[i + 1]!) {
      const hz = i * STEP_HZ
      if (hz > 200 && hz < maxHz) peaks.push(hz)
    }
  }
  return peaks
}

/** Local maxima of |signal| at least `distance` samples apart. */
export function findPeaks(signal: Float64Array, distance: number): number[] {
  const peaks: number[] = []
  let last = -Infinity
  for (let i = 1; i < signal.length - 1; i += 1) {
    const v = Math.abs(signal[i]!)
    if (v <= Math.abs(signal[i - 1]!) || v < Math.abs(signal[i + 1]!)) continue
    if (i - last < distance) continue
    peaks.push(i)
    last = i
  }
  return peaks
}

/** Inter-channel coherence and phase dispersion, 16-22 kHz. */
export function hfPhase(
  channels: Float64Array[],
  sampleRate: number,
): { coherence: number | null; dispersion: number | null } {
  if (channels.length < 2 || sampleRate < 44100) return { coherence: null, dispersion: null }

  const left = stft(channels[0]!, sampleRate)
  const right = stft(channels[1]!, sampleRate)
  const freqs = binFrequencies(sampleRate, left.bins)

  let crossRe = 0
  let crossIm = 0
  let leftPower = 0
  let rightPower = 0
  const units: { re: number; im: number }[] = []

  for (let f = 0; f < Math.min(left.frames, right.frames); f += 1) {
    for (let k = 0; k < left.bins; k += 1) {
      const hz = freqs[k]!
      if (hz < 16000 || hz > 22000) continue
      const lr = left.re[f]![k]!
      const li = left.im[f]![k]!
      const rr = right.re[f]![k]!
      const ri = right.im[f]![k]!
      // L * conj(R)
      const cr = lr * rr + li * ri
      const ci = li * rr - lr * ri
      crossRe += cr
      crossIm += ci
      leftPower += lr * lr + li * li
      rightPower += rr * rr + ri * ri
      const mag = Math.hypot(cr, ci)
      if (mag > 1e-18) units.push({ re: cr / mag, im: ci / mag })
    }
  }

  const energy = Math.sqrt(leftPower * rightPower)
  if (energy < 1e-18) return { coherence: null, dispersion: null }
  const coherence = Math.min(Math.hypot(crossRe, crossIm) / energy, 1)

  if (units.length < 8) return { coherence, dispersion: null }
  let ur = 0
  let ui = 0
  for (const u of units) {
    ur += u.re
    ui += u.im
  }
  const dispersion = Math.min(Math.max(1 - Math.hypot(ur / units.length, ui / units.length), 0), 1)
  return { coherence, dispersion }
}


/**
 * Move each onset from the STFT grid onto the sample where the note starts.
 *
 * The analysis hop is 1024 samples — 23 ms at 44.1 kHz — so a frame-resolution
 * onset time carries about 23 ms of quantisation on its own. Micro-timing is a
 * few milliseconds either side of the beat, so measured on that grid a
 * sequencer and a drummer are indistinguishable: the quantisation swamps the
 * quantity. This re-finds each onset as the steepest rise in short-time energy
 * inside its frame, which brings the resolution to about a millisecond and
 * lets the feature measure what it claims to.
 */
export function refineOnsets(
  mono: Float64Array,
  sampleRate: number,
  onsets: number[],
): number[] {
  const win = Math.max(8, Math.round(0.002 * sampleRate)) // 2 ms energy window
  const step = Math.max(1, Math.round(0.0005 * sampleRate)) // 0.5 ms resolution

  const energyAt = (centre: number): number => {
    let sum = 0
    let count = 0
    for (let i = centre; i < Math.min(centre + win, mono.length); i += 1) {
      sum += mono[i]! * mono[i]!
      count += 1
    }
    return count > 0 ? sum / count : 0
  }

  return onsets.map((time) => {
    // Analysis frames are not centred: frame f spans [f*HOP, f*HOP + FFT_SIZE),
    // so a transient first raises the flux in the frame that *starts* up to a
    // full window before it. A frame-derived onset therefore sits early by
    // anything up to FFT_SIZE, and the true attack is ahead of it, never
    // behind. The search runs forward across that whole span.
    const centre = Math.round(time * sampleRate)
    const from = Math.max(0, centre - HOP)
    const to = Math.min(mono.length - win - step, centre + FFT_SIZE + HOP)
    if (to <= from) return time

    let bestRise = -Infinity
    let bestPos = centre
    let previous = energyAt(from)
    for (let pos = from + step; pos <= to; pos += step) {
      const current = energyAt(pos)
      // Rise in log energy: a quiet note's attack is as much an onset as a
      // loud one's, and a linear difference would only ever find the loud one.
      const rise = Math.log10(current + 1e-12) - Math.log10(previous + 1e-12)
      if (rise > bestRise) {
        bestRise = rise
        bestPos = pos
      }
      previous = current
    }
    return bestPos / sampleRate
  })
}