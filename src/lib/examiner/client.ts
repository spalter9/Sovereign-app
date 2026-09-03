import type { ExamineRequest, ExamineResponse } from './worker'
import type { ExaminerFinding } from './examine'

/**
 * Decode a file locally and run the examiner in a worker.
 *
 * Decoding stays on the main thread because only it has an AudioContext; the
 * PCM is then transferred (not copied) to the worker, so a long track does not
 * double its memory on the way across.
 */

export type { ExaminerFinding }

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function examineFile(
  file: File,
  onProgress?: (stage: string, fraction: number) => void,
): Promise<ExaminerFinding> {
  const bytes = await file.arrayBuffer()
  // Hash the bytes exactly as they arrived, before decoding changes anything.
  const sha256 = await sha256Hex(bytes.slice(0))

  onProgress?.('Decoding', 0.01)
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(bytes.slice(0))
  } finally {
    void ctx.close()
  }

  const channels = decoded.numberOfChannels
  const length = decoded.length
  const samples = new Float32Array(length * channels)
  for (let ch = 0; ch < channels; ch += 1) {
    const data = decoded.getChannelData(ch)
    for (let i = 0; i < length; i += 1) samples[i * channels + ch] = data[i]!
  }

  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })

  return new Promise<ExaminerFinding>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<ExamineResponse>) => {
      const message = event.data
      if (message.type === 'progress') {
        onProgress?.(message.stage, message.fraction)
      } else if (message.type === 'done') {
        worker.terminate()
        resolve(message.finding)
      } else {
        worker.terminate()
        reject(new Error(message.message))
      }
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || 'The examiner worker failed to start.'))
    }

    const request: ExamineRequest = {
      type: 'examine',
      fileName: file.name,
      sha256,
      sampleRate: decoded.sampleRate,
      channels,
      length,
      samples,
    }
    worker.postMessage(request, [samples.buffer])
  })
}
