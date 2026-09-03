import { FFT_SIZE, HOP, binFrequencies, istft, stft, type Spectrogram } from './stft'

/**
 * Source separation in the browser, without a model.
 *
 * HTDemucs would be better and needs a host and eighty megabytes of weights.
 * What runs here instead is classical and deterministic: median-filter
 * harmonic/percussive separation (Fitzgerald, DAFx-10) to split sustained
 * content from transients, then inter-channel panning to pull the centre-
 * dominant part out of the harmonic residue, then a band split for bass.
 *
 * That yields four estimates rather than four exact sources. The separation is
 * good enough that per-source features become measurable — which is the whole
 * point, since without it the examiner can only reach a third of the evidence
 * it needs — but it is an estimate, and the report says so.
 */

export type SourceName = 'vocals' | 'drums' | 'bass' | 'other'

export type SeparatedSource = {
  /** Planar channels of the estimated source. */
  channels: Float64Array[]
  /** Share of total programme power, 0-1. */
  energyShare: number
}

export type Separation = Record<SourceName, SeparatedSource>

/** Median of a window, used by the HPSS filters. */
function medianOf(values: Float64Array, count: number): number {
  const slice = values.slice(0, count)
  slice.sort()
  const mid = count >> 1
  return count % 2 ? slice[mid]! : (slice[mid - 1]! + slice[mid]!) / 2
}

/**
 * Median filter each bin along time — sustained partials survive, transients
 * are flattened away. This is the harmonic estimate.
 */
function medianAlongTime(mag: Float64Array[], frames: number, bins: number, span: number): Float64Array[] {
  const half = span >> 1
  const out: Float64Array[] = Array.from({ length: frames }, () => new Float64Array(bins))
  const window = new Float64Array(span)
  for (let k = 0; k < bins; k += 1) {
    for (let f = 0; f < frames; f += 1) {
      let count = 0
      for (let d = -half; d <= half; d += 1) {
        const t = f + d
        if (t >= 0 && t < frames) window[count++] = mag[t]![k]!
      }
      out[f]![k] = medianOf(window, count)
    }
  }
  return out
}

/**
 * Median filter each frame along frequency — broadband transients survive,
 * narrow partials are flattened away. This is the percussive estimate.
 */
function medianAlongFreq(mag: Float64Array[], frames: number, bins: number, span: number): Float64Array[] {
  const half = span >> 1
  const out: Float64Array[] = Array.from({ length: frames }, () => new Float64Array(bins))
  const window = new Float64Array(span)
  for (let f = 0; f < frames; f += 1) {
    const row = mag[f]!
    for (let k = 0; k < bins; k += 1) {
      let count = 0
      for (let d = -half; d <= half; d += 1) {
        const b = k + d
        if (b >= 0 && b < bins) window[count++] = row[b]!
      }
      out[f]![k] = medianOf(window, count)
    }
  }
  return out
}

/** Apply a per-bin mask to a spectrogram, returning a new one. */
function applyMask(spec: Spectrogram, mask: Float64Array[]): Spectrogram {
  const re: Float64Array[] = []
  const im: Float64Array[] = []
  for (let f = 0; f < spec.frames; f += 1) {
    const sr = spec.re[f]!
    const si = spec.im[f]!
    const m = mask[f]!
    const nr = new Float64Array(spec.bins)
    const ni = new Float64Array(spec.bins)
    for (let k = 0; k < spec.bins; k += 1) {
      nr[k] = sr[k]! * m[k]!
      ni[k] = si[k]! * m[k]!
    }
    re.push(nr)
    im.push(ni)
  }
  return { re, im, frames: spec.frames, bins: spec.bins, sampleRate: spec.sampleRate }
}

function powerOf(channels: Float64Array[]): number {
  let sum = 0
  let n = 0
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i += 1) sum += ch[i]! * ch[i]!
    n += ch.length
  }
  return n > 0 ? sum / n : 0
}

export type SeparationProgress = (stage: string, fraction: number) => void

/**
 * Split a programme into four estimated sources.
 *
 * `planar` is per-channel PCM. Mono input still separates — harmonic and
 * percussive do not need two channels — but the centre-extraction step that
 * isolates vocals does, so a mono file returns everything tonal under `other`
 * rather than inventing a vocal track that the signal cannot support.
 */
export function separate(
  planar: Float64Array[],
  sampleRate: number,
  onProgress?: SeparationProgress,
): Separation {
  const length = planar[0]?.length ?? 0
  const stereo = planar.length >= 2

  onProgress?.('Transforming', 0.05)
  const specs = planar.map((ch) => stft(ch, sampleRate))
  const { frames, bins } = specs[0]!

  // Magnitude of the mid channel drives the masks, so both channels are cut
  // with the same decision and the stereo image of each source survives.
  const mid: Float64Array[] = Array.from({ length: frames }, () => new Float64Array(bins))
  for (let f = 0; f < frames; f += 1) {
    for (let k = 0; k < bins; k += 1) {
      let sum = 0
      for (const s of specs) sum += Math.hypot(s.re[f]![k]!, s.im[f]![k]!)
      mid[f]![k] = sum / specs.length
    }
  }

  onProgress?.('Separating harmonic from percussive', 0.2)
  // 17 frames ≈ 400 ms of context; 17 bins ≈ 180 Hz. Both odd so the median
  // has a true centre, and both close to the values the reference paper uses.
  const harmonicMag = medianAlongTime(mid, frames, bins, 17)
  const percussiveMag = medianAlongFreq(mid, frames, bins, 17)

  // Wiener-style soft masks with a power of 2: softer than a binary mask, so
  // a bin shared between a cymbal and a held chord is divided rather than
  // handed whole to whichever won by a hair.
  const harmonicMask: Float64Array[] = Array.from({ length: frames }, () => new Float64Array(bins))
  const percussiveMask: Float64Array[] = Array.from({ length: frames }, () => new Float64Array(bins))
  for (let f = 0; f < frames; f += 1) {
    for (let k = 0; k < bins; k += 1) {
      const h = harmonicMag[f]![k]! ** 2
      const p = percussiveMag[f]![k]! ** 2
      const total = h + p
      if (total > 1e-20) {
        harmonicMask[f]![k] = h / total
        percussiveMask[f]![k] = p / total
      }
    }
  }

  onProgress?.('Locating the centre image', 0.45)
  const freqs = binFrequencies(sampleRate, bins)

  // Centre dominance: 1 where the two channels agree, 0 where they differ.
  // A lead vocal is almost always centred; pads and doubles are not.
  const centreMask: Float64Array[] = Array.from({ length: frames }, () => new Float64Array(bins))
  if (stereo) {
    const [l, r] = specs as [Spectrogram, Spectrogram]
    for (let f = 0; f < frames; f += 1) {
      for (let k = 0; k < bins; k += 1) {
        const lre = l.re[f]![k]!
        const lim = l.im[f]![k]!
        const rre = r.re[f]![k]!
        const rim = r.im[f]![k]!
        const lm = Math.hypot(lre, lim)
        const rm = Math.hypot(rre, rim)
        const sum = lm + rm
        if (sum > 1e-20 && lm > 1e-20 && rm > 1e-20) {
          // Equal magnitudes alone do not mean centred: a hard-wide part sits
          // anti-phase across the pair and measures identically to a centred
          // one. The real part of L·conj(R) separates them — +1 in phase,
          // -1 opposed — so phase decides and magnitude only refines.
          const coherence = (lre * rre + lim * rim) / (lm * rm)
          const inPhase = Math.max(0, coherence)
          const balance = Math.abs(lm - rm) / sum
          // Vocal band only: centred sub-bass is the kick and the bass guitar.
          const hz = freqs[k]!
          const inBand = hz >= 180 && hz <= 12000 ? 1 : 0
          centreMask[f]![k] = inPhase * (1 - balance) * inBand
        }
      }
    }
  }

  const vocalMask: Float64Array[] = Array.from({ length: frames }, () => new Float64Array(bins))
  const bassMask: Float64Array[] = Array.from({ length: frames }, () => new Float64Array(bins))
  const otherMask: Float64Array[] = Array.from({ length: frames }, () => new Float64Array(bins))

  for (let f = 0; f < frames; f += 1) {
    for (let k = 0; k < bins; k += 1) {
      const h = harmonicMask[f]![k]!
      const hz = freqs[k]!
      const low = hz < 250 ? 1 : 0
      const v = h * centreMask[f]![k]!
      const b = h * low * (1 - centreMask[f]![k]!)
      vocalMask[f]![k] = v
      bassMask[f]![k] = b
      otherMask[f]![k] = Math.max(0, h - v - b)
    }
  }

  onProgress?.('Rendering sources', 0.65)
  const render = (mask: Float64Array[]): Float64Array[] =>
    specs.map((s) => istft(applyMask(s, mask), length))

  const vocals = stereo ? render(vocalMask) : planar.map(() => new Float64Array(length))
  const drums = render(percussiveMask)
  const bass = render(bassMask)
  const other = render(otherMask)

  onProgress?.('Weighing sources', 0.9)
  const powers = {
    vocals: powerOf(vocals),
    drums: powerOf(drums),
    bass: powerOf(bass),
    other: powerOf(other),
  }
  const total = powers.vocals + powers.drums + powers.bass + powers.other

  const share = (p: number) => (total > 0 ? p / total : 0)

  return {
    vocals: { channels: vocals, energyShare: share(powers.vocals) },
    drums: { channels: drums, energyShare: share(powers.drums) },
    bass: { channels: bass, energyShare: share(powers.bass) },
    other: { channels: other, energyShare: share(powers.other) },
  }
}

export { FFT_SIZE, HOP }
