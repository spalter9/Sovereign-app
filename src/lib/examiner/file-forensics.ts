/**
 * File-level provenance forensics.
 *
 * Separate from the acoustic model, and far stronger on unmodified files: an
 * AI music generator does not just make sound, it makes a *file*, and the
 * container carries fingerprints of the pipeline that made it. Across 69
 * tracks of known provenance the single field `sample rate` separated the two
 * classes at 97% — every generated track exported at 48 kHz, nearly every
 * recorded one at 44.1 kHz, because that is what the two kinds of tool emit.
 *
 * The catch, stated plainly because it decides everything: this reads the
 * export pipeline, not the audio. Re-encode a generated track to 44.1 kHz and
 * it looks recorded; bounce a studio session to 48 kHz and it looks generated.
 * So it is decisive on an original file and worthless on a re-encoded one —
 * which is exactly why it is paired with the acoustic model rather than
 * trusted alone. When a file has clearly been through a converter, this signal
 * stands down and the robust acoustic score carries the reading.
 */

export type FileForensics = {
  /** Sample rate read from the container header, not the decoder. */
  sampleRate: number | null
  /** Container/codec family, e.g. 'mp3', 'mp4/aac', 'wav', 'aiff'. */
  container: string
  /** Encoder string from metadata, when present (iTunes, LAME, Lavf…). */
  encoder: string | null
  /** The pipeline's leaning, before it is weighed against the audio. */
  leaning: 'generated_pipeline' | 'recorded_pipeline' | 'inconclusive'
  /** Plain-language reading. */
  note: string
  /** True when the file shows signs of re-encoding that void the signal. */
  reencoded: boolean
}

const MP3_SR = [
  [11025, 12000, 8000], // MPEG 2.5
  [0, 0, 0], // reserved
  [22050, 24000, 16000], // MPEG 2
  [44100, 48000, 32000], // MPEG 1
] as const

/** Read the sample rate from the first MP3 frame header. */
function mp3SampleRate(bytes: Uint8Array): number | null {
  // Skip an ID3v2 tag if present so the sync search starts at audio.
  let start = 0
  if (bytes.length > 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const size =
      ((bytes[6]! & 0x7f) << 21) |
      ((bytes[7]! & 0x7f) << 14) |
      ((bytes[8]! & 0x7f) << 7) |
      (bytes[9]! & 0x7f)
    start = 10 + size
  }
  for (let i = start; i < Math.min(bytes.length - 4, start + 200000); i += 1) {
    if (bytes[i] !== 0xff || (bytes[i + 1]! & 0xe0) !== 0xe0) continue
    const version = (bytes[i + 1]! >> 3) & 0x03
    const srIndex = (bytes[i + 2]! >> 2) & 0x03
    if (srIndex === 3) continue
    const rate = MP3_SR[version]?.[srIndex]
    if (rate) return rate
  }
  return null
}

/** Read timescale (sample rate) from an MP4/M4A `mdhd` box. */
function mp4SampleRate(bytes: Uint8Array): number | null {
  // Find the audio track's mdhd box by scanning for the atom name.
  for (let i = 0; i < bytes.length - 24; i += 1) {
    if (bytes[i] === 0x6d && bytes[i + 1] === 0x64 && bytes[i + 2] === 0x68 && bytes[i + 3] === 0x64) {
      const version = bytes[i + 4]!
      // version 0: timescale at +16; version 1: at +24
      const off = version === 1 ? i + 24 : i + 16
      const ts = (bytes[off]! << 24) | (bytes[off + 1]! << 16) | (bytes[off + 2]! << 8) | bytes[off + 3]!
      // Audio timescales are the sample rate; skip the movie header's 600/1000.
      if (ts >= 8000 && ts <= 192000) return ts
    }
  }
  return null
}

/** Read sample rate from a RIFF/WAVE `fmt ` chunk. */
function wavSampleRate(bytes: Uint8Array): number | null {
  for (let i = 12; i < bytes.length - 12; ) {
    const id = String.fromCharCode(bytes[i]!, bytes[i + 1]!, bytes[i + 2]!, bytes[i + 3]!)
    const size = bytes[i + 4]! | (bytes[i + 5]! << 8) | (bytes[i + 6]! << 16) | (bytes[i + 7]! << 24)
    if (id === 'fmt ') {
      const o = i + 8
      return bytes[o + 4]! | (bytes[o + 5]! << 8) | (bytes[o + 6]! << 16) | (bytes[o + 7]! << 24)
    }
    i += 8 + size + (size % 2)
  }
  return null
}

/** Read sample rate from an AIFF `COMM` chunk (80-bit float). */
function aiffSampleRate(bytes: Uint8Array): number | null {
  for (let i = 12; i < bytes.length - 26; ) {
    const id = String.fromCharCode(bytes[i]!, bytes[i + 1]!, bytes[i + 2]!, bytes[i + 3]!)
    const size = (bytes[i + 4]! << 24) | (bytes[i + 5]! << 16) | (bytes[i + 6]! << 8) | bytes[i + 7]!
    if (id === 'COMM') {
      // 80-bit IEEE extended at offset +16; decode enough for common rates.
      const o = i + 8 + 8
      const exp = ((bytes[o]! << 8) | bytes[o + 1]!) - 16383
      const mantissaHi = (bytes[o + 2]! << 24) | (bytes[o + 3]! << 16) | (bytes[o + 4]! << 8) | bytes[o + 5]!
      const value = Math.round((mantissaHi >>> 0) * Math.pow(2, exp - 31))
      if (value >= 8000 && value <= 192000) return value
    }
    i += 8 + size + (size % 2)
  }
  return null
}

function findAscii(bytes: Uint8Array, needle: string): boolean {
  const n = needle.split('').map((c) => c.charCodeAt(0))
  for (let i = 0; i < bytes.length - n.length; i += 1) {
    let ok = true
    for (let j = 0; j < n.length; j += 1) if (bytes[i + j] !== n[j]) { ok = false; break }
    if (ok) return true
  }
  return false
}

export function analyseFile(bytes: ArrayBuffer, fileName: string): FileForensics {
  const u = new Uint8Array(bytes)
  const head = u.subarray(0, 64 * 1024)
  const ext = (fileName.split('.').pop() ?? '').toLowerCase()

  let container = 'unknown'
  let sampleRate: number | null = null

  if (u[0] === 0x49 && u[1] === 0x44 && u[2] === 0x33) {
    container = 'mp3'
    sampleRate = mp3SampleRate(u)
  } else if (u[0] === 0xff && (u[1]! & 0xe0) === 0xe0) {
    container = 'mp3'
    sampleRate = mp3SampleRate(u)
  } else if (u[4] === 0x66 && u[5] === 0x74 && u[6] === 0x79 && u[7] === 0x70) {
    container = 'mp4/aac'
    sampleRate = mp4SampleRate(u)
  } else if (u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46) {
    container = 'wav'
    sampleRate = wavSampleRate(u)
  } else if (u[0] === 0x46 && u[1] === 0x4f && u[2] === 0x52 && u[3] === 0x4d) {
    container = 'aiff'
    sampleRate = aiffSampleRate(u)
  } else if (ext === 'mp3') {
    container = 'mp3'
    sampleRate = mp3SampleRate(u)
  }

  // Encoder tells the pipeline apart within a format: a generator's ffmpeg
  // (Lavf) export looks different from an Apple/iTunes or DAW export.

  let encoder: string | null = findAscii(head, 'Lavf')
    ? 'Lavf (ffmpeg)'
    : findAscii(head, 'iTunes')
      ? 'iTunes'
      : findAscii(head, 'LAME')
        ? 'LAME'
        : findAscii(head, 'Logic') || findAscii(head, 'Pro Tools')
          ? 'DAW'
          : null

  // 48 kHz + an ffmpeg/no encoder tag is the generated-pipeline signature;
  // 44.1 kHz, especially from iTunes/AAC/AIFF, is the recorded-pipeline one.
  const generatedPipeline =
    sampleRate === 48000 && (encoder === 'Lavf (ffmpeg)' || encoder === null)
  const recordedPipeline =
    sampleRate === 44100 || container === 'mp4/aac' || container === 'aiff' || encoder === 'iTunes'

  const reencoded =
    // A consumer container at 48 kHz, or a DAW/iTunes tag at 48 kHz, means the
    // rate signal is not trustworthy on its own.
    (sampleRate === 48000 && (container === 'mp4/aac' || encoder === 'iTunes')) ||
    sampleRate === null

  let leaning: FileForensics['leaning'] = 'inconclusive'
  if (!reencoded && generatedPipeline) leaning = 'generated_pipeline'
  else if (!reencoded && recordedPipeline) leaning = 'recorded_pipeline'

  const srText = sampleRate ? `${(sampleRate / 1000).toFixed(1)} kHz` : 'unknown rate'
  const note =
    leaning === 'generated_pipeline'
      ? `Exported at ${srText}${encoder ? ` via ${encoder}` : ''} — the signature of an AI generator's output pipeline, which renders at 48 kHz. Decisive only if the file has not been re-encoded.`
      : leaning === 'recorded_pipeline'
        ? `Exported at ${srText}${encoder ? ` via ${encoder}` : ''} — a studio/consumer pipeline (44.1 kHz, Apple/DAW), not a generator's default.`
        : `File pipeline is inconclusive (${srText}${encoder ? `, ${encoder}` : ''}); it may have been re-encoded, so this signal stands down and the audio measurement decides.`

  return { sampleRate, container, encoder, leaning, note, reencoded }
}
