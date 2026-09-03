/// <reference lib="webworker" />
import { examine, type ExaminerFinding } from './examine'
import type { AudioBuffer32 } from './audio-types'

/**
 * The examiner off the main thread.
 *
 * A four-minute track means four STFTs, two median filters over a spectrogram
 * of some ten thousand frames, four inverse transforms and a pitch track per
 * source. On the main thread that freezes the console for the duration; here
 * the page stays live and reports progress while it runs.
 */

export type ExamineRequest = {
  type: 'examine'
  fileName: string
  sha256: string
  sampleRate: number
  channels: number
  length: number
  samples: Float32Array
}

export type ExamineResponse =
  | { type: 'progress'; stage: string; fraction: number }
  | { type: 'done'; finding: ExaminerFinding }
  | { type: 'error'; message: string }

self.onmessage = (event: MessageEvent<ExamineRequest>) => {
  const request = event.data
  if (request.type !== 'examine') return

  const post = (message: ExamineResponse) => self.postMessage(message)

  try {
    const audio: AudioBuffer32 = {
      sampleRate: request.sampleRate,
      channels: request.channels,
      samples: request.samples,
      length: request.length,
      bitDepth: 32,
      format: 'float32',
    }
    const finding = examine(
      audio,
      { fileName: request.fileName, sha256: request.sha256 },
      (stage, fraction) => post({ type: 'progress', stage, fraction }),
    )
    post({ type: 'done', finding })
  } catch (error) {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : 'The examiner failed on this container.',
    })
  }
}
