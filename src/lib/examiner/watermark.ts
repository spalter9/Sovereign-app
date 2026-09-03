/**
 * Watermark detection — the fourth provenance layer.
 *
 * Several generators now embed an inaudible watermark in their output: Suno
 * and Udio their own proprietary marks, Google's SynthID in its Lyria model,
 * Meta's open AudioSeal. Where one is present AND its detector is available,
 * it is the strongest signal of all — near-certain for that vendor.
 *
 * The honesty this layer has to carry: a watermark is only detectable with
 * the vendor's own detector or key, and almost none are public. There is no
 * universal watermark detector and there cannot be one, because each mark is
 * proprietary. So this layer reports, per vendor, whether a detector is wired
 * in and what it found — and where none is, it says so plainly rather than
 * implying a clean track is unwatermarked. Absence of a detected watermark is
 * never evidence of human authorship: it may just mean this vendor's detector
 * is not licensed, or the generator did not watermark, or the mark was
 * stripped.
 *
 * The architecture is a registry of detectors. Today it ships empty — the
 * detectors are vendor-gated and cannot run in-browser without their weights
 * and keys — so every check returns `unavailable`. As detectors are licensed
 * (or an open one like AudioSeal is hosted alongside the forensics worker),
 * they register here and light up without any change to the verdict logic.
 */

import type { AudioBuffer32 } from './audio-types'

export type WatermarkVendor = 'suno' | 'udio' | 'synthid' | 'audioseal'

export type WatermarkResult = {
  vendor: WatermarkVendor
  status: 'detected' | 'absent' | 'unavailable'
  /** Confidence when detected, 0-1. */
  confidence?: number
  note: string
}

export type WatermarkDetector = {
  vendor: WatermarkVendor
  label: string
  /** Resolves to a result; may call a licensed endpoint or a hosted model. */
  detect(audio: AudioBuffer32): Promise<WatermarkResult>
}

const REGISTRY = new Map<WatermarkVendor, WatermarkDetector>()

/** Register a detector once its key/model is available in this deployment. */
export function registerWatermarkDetector(detector: WatermarkDetector): void {
  REGISTRY.set(detector.vendor, detector)
}

const VENDORS: { vendor: WatermarkVendor; label: string }[] = [
  { vendor: 'suno', label: 'Suno' },
  { vendor: 'udio', label: 'Udio' },
  { vendor: 'synthid', label: 'Google SynthID (Lyria)' },
  { vendor: 'audioseal', label: 'Meta AudioSeal' },
]

export type WatermarkReport = {
  results: WatermarkResult[]
  /** True if any registered detector positively found a mark. */
  anyDetected: boolean
  /** How many vendors have a detector wired in at all. */
  covered: number
  note: string
}

export async function checkWatermarks(audio: AudioBuffer32): Promise<WatermarkReport> {
  const results: WatermarkResult[] = []
  for (const { vendor, label } of VENDORS) {
    const detector = REGISTRY.get(vendor)
    if (!detector) {
      results.push({
        vendor,
        status: 'unavailable',
        note: `${label}: no detector licensed in this deployment. A ${label} watermark, if present, cannot be read without ${label}'s own detector.`,
      })
      continue
    }
    try {
      results.push(await detector.detect(audio))
    } catch {
      results.push({ vendor, status: 'unavailable', note: `${label}: detector errored.` })
    }
  }

  const anyDetected = results.some((r) => r.status === 'detected')
  const covered = results.filter((r) => r.status !== 'unavailable').length
  const note = anyDetected
    ? 'A generator watermark was positively detected — the strongest available signal of machine origin.'
    : covered === 0
      ? 'No watermark detector is licensed in this deployment, so no watermark check was performed. This says nothing about origin: absence of a check is not absence of a watermark.'
      : 'The licensed detectors found no watermark. That is not proof of human authorship — an unlicensed vendor, an unwatermarked generator, or a stripped mark all read the same way.'

  return { results, anyDetected, covered, note }
}
