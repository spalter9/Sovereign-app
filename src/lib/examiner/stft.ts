import { fft, hann } from './dsp'

/**
 * Short-time Fourier transform and its inverse.
 *
 * Frame and hop match the Python worker (4096 / 1024) so a measurement taken
 * here and one taken on the forensics host are describing the same thing. A
 * feature is only comparable across implementations if the analysis window
 * that produced it is identical.
 */

export const FFT_SIZE = 4096
export const HOP = 1024
export const SILENCE_RMS = 1e-5

export type Spectrogram = {
  /** Real part, frames × bins (bins = FFT_SIZE/2 + 1). */
  re: Float64Array[]
  im: Float64Array[]
  frames: number
  bins: number
  sampleRate: number
}

/** Bin index → centre frequency in Hz. */
export function binFrequencies(sampleRate: number, bins: number): Float64Array {
  const freqs = new Float64Array(bins)
  for (let k = 0; k < bins; k += 1) freqs[k] = (k * sampleRate) / FFT_SIZE
  return freqs
}

export function stft(signal: Float64Array, sampleRate: number): Spectrogram {
  const window = hann(FFT_SIZE)
  const bins = FFT_SIZE / 2 + 1
  const frames = signal.length < FFT_SIZE ? 1 : 1 + Math.floor((signal.length - FFT_SIZE) / HOP)

  const re: Float64Array[] = []
  const im: Float64Array[] = []

  const bufRe = new Float64Array(FFT_SIZE)
  const bufIm = new Float64Array(FFT_SIZE)

  for (let f = 0; f < frames; f += 1) {
    const start = f * HOP
    bufIm.fill(0)
    for (let n = 0; n < FFT_SIZE; n += 1) {
      const s = start + n
      bufRe[n] = s < signal.length ? signal[s]! * window[n]! : 0
    }
    fft(bufRe, bufIm)
    re.push(bufRe.slice(0, bins))
    im.push(bufIm.slice(0, bins))
  }

  return { re, im, frames, bins, sampleRate }
}

/** Magnitude of one frame. */
export function magnitudeOf(spec: Spectrogram, frame: number): Float64Array {
  const re = spec.re[frame]!
  const im = spec.im[frame]!
  const mag = new Float64Array(spec.bins)
  for (let k = 0; k < spec.bins; k += 1) mag[k] = Math.hypot(re[k]!, im[k]!)
  return mag
}

/** Mean magnitude across all frames — the average spectrum. */
export function meanSpectrum(spec: Spectrogram): Float64Array {
  const mean = new Float64Array(spec.bins)
  if (spec.frames === 0) return mean
  for (let f = 0; f < spec.frames; f += 1) {
    const re = spec.re[f]!
    const im = spec.im[f]!
    for (let k = 0; k < spec.bins; k += 1) mean[k] += Math.hypot(re[k]!, im[k]!)
  }
  for (let k = 0; k < spec.bins; k += 1) mean[k] /= spec.frames
  return mean
}

/**
 * Inverse STFT by weighted overlap-add.
 *
 * The synthesis window is the same Hann as analysis, and the running sum of
 * squared windows divides out at the end. That makes the transform exactly
 * invertible in the interior, so an unmasked round trip returns the input
 * rather than something close to it — which is what lets a separated source
 * be trusted as a signal in its own right.
 */
export function istft(spec: Spectrogram, length: number): Float64Array {
  const window = hann(FFT_SIZE)
  const out = new Float64Array(length)
  const norm = new Float64Array(length)

  const bufRe = new Float64Array(FFT_SIZE)
  const bufIm = new Float64Array(FFT_SIZE)

  for (let f = 0; f < spec.frames; f += 1) {
    const re = spec.re[f]!
    const im = spec.im[f]!
    // Rebuild the full hermitian spectrum from the half we keep.
    for (let k = 0; k < spec.bins; k += 1) {
      bufRe[k] = re[k]!
      bufIm[k] = im[k]!
    }
    for (let k = spec.bins; k < FFT_SIZE; k += 1) {
      const mirror = FFT_SIZE - k
      bufRe[k] = re[mirror]!
      bufIm[k] = -im[mirror]!
    }
    // Inverse via conjugation: conj(FFT(conj(X))) / N.
    for (let k = 0; k < FFT_SIZE; k += 1) bufIm[k] = -bufIm[k]!
    fft(bufRe, bufIm)

    const start = f * HOP
    for (let n = 0; n < FFT_SIZE; n += 1) {
      const s = start + n
      if (s >= length) break
      const sample = bufRe[n]! / FFT_SIZE
      out[s] += sample * window[n]!
      norm[s] += window[n]! * window[n]!
    }
  }

  // The first and last frames overlap-add only partially, so `norm` tails off
  // to nearly nothing there. Dividing by it would amplify the edges by orders
  // of magnitude and hand every downstream measurement — energy share most of
  // all — a burst of pure artefact. Flooring the divisor at half the
  // steady-state value lets the edges fade in instead, which is what the
  // signal actually does.
  let steady = 0
  for (let i = 0; i < length; i += 1) if (norm[i]! > steady) steady = norm[i]!
  const floor = steady * 0.5
  if (floor <= 0) return out
  for (let i = 0; i < length; i += 1) {
    out[i] = out[i]! / Math.max(norm[i]!, floor)
  }
  return out
}
