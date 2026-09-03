/**
 * Speech recognition on the separated vocal, in the browser.
 *
 * Whisper runs through transformers.js on WebAssembly. The model is fetched
 * on first use and cached by the browser afterwards; nothing is uploaded —
 * the weights come down, the audio never goes up, which keeps the promise the
 * rest of this console makes.
 *
 * It transcribes the *separated vocal*, not the mix. Recognition against a
 * full backing track is markedly worse, and the separation step has already
 * been paid for by the time this runs.
 */

export type TranscriptionProgress = (stage: string, fraction: number) => void

export type Transcript = {
  text: string
  /** Lines as the recogniser segmented them. */
  lines: string[]
  model: string
  /** Seconds of audio actually fed to the recogniser. */
  analysedSec: number
}

/** Whisper expects 16 kHz mono. */
function resampleTo16k(mono: Float64Array, sampleRate: number): Float32Array {
  const target = 16000
  if (sampleRate === target) return Float32Array.from(mono)
  const ratio = sampleRate / target
  const out = new Float32Array(Math.floor(mono.length / ratio))
  for (let i = 0; i < out.length; i += 1) {
    const at = i * ratio
    const lo = Math.floor(at)
    const hi = Math.min(lo + 1, mono.length - 1)
    const frac = at - lo
    // Linear interpolation is sufficient here: the recogniser's own front end
    // is a mel filterbank, which is far coarser than the resampling error.
    out[i] = (mono[lo]! * (1 - frac) + mono[hi]! * frac) as number
  }
  return out
}

function normalise(samples: Float32Array): Float32Array {
  let peak = 0
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.abs(samples[i]!)
    if (v > peak) peak = v
  }
  if (peak < 1e-6) return samples
  const gain = 0.95 / peak
  for (let i = 0; i < samples.length; i += 1) samples[i] = samples[i]! * gain
  return samples
}

/**
 * Split the transcript into lines.
 *
 * Whisper returns running prose with no line breaks, and the stylometry reads
 * line length and rhyme position — so the text has to be broken somewhere.
 * Sentence punctuation is the only structural signal available, with a length
 * cap so a long unpunctuated stretch still yields lines rather than one
 * enormous one.
 */
export function segmentLines(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  const rough = cleaned.split(/(?<=[.!?,;])\s+/)
  const out: string[] = []
  const MAX_WORDS = 12
  for (const piece of rough) {
    const words = piece.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) continue
    for (let i = 0; i < words.length; i += MAX_WORDS) {
      out.push(words.slice(i, i + MAX_WORDS).join(' ').replace(/[,;]$/, ''))
    }
  }
  return out.filter((l) => l.length > 0)
}

export type TranscribeOptions = {
  /** Cap the audio fed to the recogniser. Whisper is slow; lyrics repeat. */
  maxSeconds?: number
  model?: string
}

export async function transcribeVocal(
  vocalChannels: Float64Array[],
  sampleRate: number,
  onProgress?: TranscriptionProgress,
  options: TranscribeOptions = {},
): Promise<Transcript> {
  const model = options.model ?? 'Xenova/whisper-tiny.en'
  const maxSeconds = options.maxSeconds ?? 120

  onProgress?.('Preparing the vocal', 0.05)
  const n = vocalChannels[0]?.length ?? 0
  const mono = new Float64Array(n)
  for (const ch of vocalChannels) for (let i = 0; i < n; i += 1) mono[i] += ch[i]!
  for (let i = 0; i < n; i += 1) mono[i] /= Math.max(1, vocalChannels.length)

  const capped = mono.length / sampleRate > maxSeconds
    ? mono.slice(0, Math.round(maxSeconds * sampleRate))
    : mono
  const samples = normalise(resampleTo16k(capped, sampleRate))

  onProgress?.('Loading the recogniser', 0.1)
  // Imported lazily so the console does not carry the runtime unless the user
  // actually asks for a transcription.
  const { pipeline, env } = await import('@xenova/transformers')
  env.allowLocalModels = false

  const recogniser = await pipeline('automatic-speech-recognition', model, {
    progress_callback: (p: { status?: string; progress?: number }) => {
      if (p.status === 'progress' && typeof p.progress === 'number') {
        onProgress?.('Downloading the recogniser', 0.1 + (p.progress / 100) * 0.35)
      }
    },
  })

  onProgress?.('Transcribing', 0.5)
  const result = (await recogniser(samples, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: false,
  })) as { text?: string }

  const text = (result.text ?? '').trim()
  onProgress?.('Reading the writing', 0.95)

  return {
    text,
    lines: segmentLines(text),
    model,
    analysedSec: samples.length / 16000,
  }
}
