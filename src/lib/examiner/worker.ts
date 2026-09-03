/// <reference lib="webworker" />
import { examine, type ExaminerFinding } from './examine'
import { transcribeVocal, type Transcript } from './transcribe'
import { analyseLyrics, type LyricAnalysis } from './lyric-analysis'
import type { AudioBuffer32 } from './audio-types'

/**
 * The examiner off the main thread.
 *
 * A four-minute track means four STFTs, two median filters over a spectrogram
 * of some ten thousand frames, four inverse transforms and a pitch track per
 * source. On the main thread that freezes the console for the duration; here
 * the page stays live and reports progress while it runs.
 */

export type LyricRequest = { type: 'lyrics' }

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
  | { type: 'lyrics'; transcript: Transcript; analysis: LyricAnalysis }
  | { type: 'error'; message: string }

/** Held between the examine and lyrics steps so separation is paid for once. */
let retainedVocal: { channels: Float64Array[]; sampleRate: number } | null = null

self.onmessage = async (event: MessageEvent<ExamineRequest | LyricRequest>) => {
  const request = event.data
  const post = (message: ExamineResponse) => self.postMessage(message)

  if (request.type === 'lyrics') {
    if (!retainedVocal) {
      post({ type: 'error', message: 'Examine a container before reading its lyrics.' })
      return
    }
    try {
      const transcript = await transcribeVocal(
        retainedVocal.channels,
        retainedVocal.sampleRate,
        (stage, fraction) => post({ type: 'progress', stage, fraction }),
      )
      post({ type: 'lyrics', transcript, analysis: analyseLyrics(transcript.lines.join('\n')) })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      // The first run fetches model weights, and a blocked or offline network
      // surfaces as a bare "Failed to fetch" — accurate and useless. Say what
      // was actually being attempted.
      const network = /fetch|network|load model|Unauthorized|404/i.test(detail)
      post({
        type: 'error',
        message: network
          ? 'Could not download the speech model. The lyric scan needs to fetch it once (~40 MB) before it can run offline; check the connection and try again.'
          : `Could not transcribe the vocal — ${detail}`,
      })
    }
    return
  }

  if (request.type !== 'examine') return

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
    // The vocal stays here rather than crossing to the page: it is large, and
    // the only thing that needs it is the transcriber, which also lives here.
    retainedVocal = finding.vocalChannels
      ? { channels: finding.vocalChannels, sampleRate: audio.sampleRate }
      : null
    delete finding.vocalChannels
    post({ type: 'done', finding })
  } catch (error) {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : 'The examiner failed on this container.',
    })
  }
}
