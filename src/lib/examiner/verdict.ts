import type { TrackProvenance } from './provenance'
import type { FileForensics } from './file-forensics'
import type { WatermarkReport } from './watermark'
import type { LyricAnalysis } from './lyric-analysis'

/**
 * One answer, from both halves of the examination.
 *
 * A record has two authorships that the Copyright Office treats separately:
 * the sound recording, and the words. They can have different origins — a
 * person's lyrics over a generated track is the ordinary case now — so this
 * reports them separately and then says what the pair supports.
 *
 * It reports only what has been validated. The per-stem performance
 * measurements are excluded entirely: tested against eight tracks of known
 * provenance, not one of their features separated generated from recorded
 * audio, and a verdict built on them would be confident noise.
 *
 * The recording side uses the three-measurement provenance classifier. On 29
 * tracks of known provenance, validated by holding each track out, it reaches
 * 79% balanced accuracy — real signal, but nowhere near proof, and it fell as
 * the sample grew, so it is treated as a weak screening lean that abstains
 * whenever it is unsure and never drives the finding. The lyric side is
 * stylometry, also a leaning and never proof. What a filing actually rests on
 * is the authorship record: the applicant's own attestation, hashed and bound
 * to the recording.
 */

export type SideReading = {
  side: 'recording' | 'lyrics'
  /** What the evidence points to, in plain words. */
  finding: string
  /** How much weight it can carry. */
  strength: 'measured' | 'leaning' | 'not_established'
  detail: string
}

export type CombinedVerdict = {
  headline: string
  recording: SideReading
  lyrics: SideReading
  /** What a filer should do with this, given both sides. */
  filingNote: string
  /** Anything that must be said out loud before this is relied on. */
  caveats: string[]
}

export function combineVerdict(
  provenance: TrackProvenance,
  lyrics: LyricAnalysis | null,
  fileForensics?: FileForensics,
  watermarks?: WatermarkReport,
): CombinedVerdict {
  const caveats: string[] = []

  // ── tier 0: a detected vendor watermark is the strongest signal ─────────
  const watermarkHit = watermarks?.anyDetected
    ? watermarks.results.find((r) => r.status === 'detected') ?? null
    : null
  if (watermarks) caveats.push(watermarks.note)

  // ── the recording: file + acoustic tiers (watermark overrides below) ────
  // Tier 1 is the file's own pipeline signature — 97% on original files, but
  // void the moment a file is re-encoded. Tier 2 is the acoustic model — ~79%
  // but robust to re-encoding. When the file signature is decisive it leads
  // and the audio corroborates; when the file has been re-encoded the audio
  // carries the reading alone.
  const ff = fileForensics
  const fileGenerated = ff?.leaning === 'generated_pipeline'
  const fileRecorded = ff?.leaning === 'recorded_pipeline'
  const audioGenerated = provenance.resembles === 'generated'
  const audioRecorded = provenance.resembles === 'recorded'

  let recording: SideReading
  if (watermarkHit) {
    recording = {
      side: 'recording',
      finding: 'Machine-generated — a generator watermark was detected.',
      strength: 'measured',
      detail: watermarkHit.note,
    }
  } else if (fileGenerated) {
    recording = {
      side: 'recording',
      finding: audioGenerated
        ? 'Machine-generated — the file signature and the audio agree.'
        : 'The file is a machine-generation export.',
      strength: 'measured',
      detail: `${ff!.note}${audioGenerated ? ' The acoustic measurement agrees.' : audioRecorded ? ' The acoustic measurement leans the other way, so confirm the file is the original.' : ''}`,
    }
  } else if (fileRecorded) {
    recording = {
      side: 'recording',
      finding: audioGenerated
        ? 'The file is a studio/consumer export, but the audio leans generated — check provenance.'
        : 'The file is a studio/consumer export.',
      strength: 'measured',
      detail: `${ff!.note}${audioRecorded ? ' The acoustic measurement agrees.' : ''}`,
    }
  } else if (audioGenerated) {
    recording = {
      side: 'recording',
      finding: 'The recording looks machine-generated.',
      strength: 'measured',
      detail: `${ff ? ff.note + ' ' : ''}${provenance.note}`,
    }
  } else if (audioRecorded) {
    recording = {
      side: 'recording',
      finding: 'The recording looks like a physical capture.',
      strength: 'measured',
      detail: `${ff ? ff.note + ' ' : ''}${provenance.note}`,
    }
  } else {
    recording = {
      side: 'recording',
      finding: 'The recording cannot be placed either way.',
      strength: 'not_established',
      detail: `${ff ? ff.note + ' ' : ''}${provenance.note}`,
    }
  }
  caveats.push(
    'The recording reading has two tiers. The file signature (sample rate and encoder) separates generated from recorded exports at 97% on original files but is void if a file has been re-encoded. The acoustic model is ~79% and robust to re-encoding. Neither is proof; a filing rests on the authorship record below.',
  )

  // ── the lyrics ─────────────────────────────────────────────────────────
  let lyricSide: SideReading
  if (!lyrics || lyrics.tooShort) {
    lyricSide = {
      side: 'lyrics',
      finding: 'The lyrics have not been read.',
      strength: 'not_established',
      detail: lyrics
        ? lyrics.note
        : 'Paste the lyrics, or transcribe the vocal and correct it, to include the writing in this reading.',
    }
  } else if (lyrics.leaning === 'reads_generated') {
    lyricSide = {
      side: 'lyrics',
      finding: 'The writing carries markers of generation.',
      strength: 'leaning',
      detail: lyrics.note,
    }
  } else if (lyrics.leaning === 'reads_human_written') {
    lyricSide = {
      side: 'lyrics',
      finding: 'The writing reads as written by a person.',
      strength: 'leaning',
      detail: lyrics.note,
    }
  } else {
    lyricSide = {
      side: 'lyrics',
      finding: 'The writing does not lean either way.',
      strength: 'not_established',
      detail: lyrics.note,
    }
  }
  if (lyrics && !lyrics.tooShort) {
    caveats.push(
      'The lyric reading is a leaning from writing style, never proof of who wrote something. It calls writing generated only where the markers are positively present, so plain or repetitive lyrics are never treated as evidence of a machine.',
    )
  }

  // ── what the pair supports ─────────────────────────────────────────────
  const generatedAudio = !!watermarkHit || fileGenerated || provenance.resembles === 'generated'
  const recordedAudio = fileRecorded || provenance.resembles === 'recorded'
  const humanWords = lyricSide.finding.startsWith('The writing reads as written')
  const generatedWords = lyricSide.finding.startsWith('The writing carries markers')

  let headline: string
  let filingNote: string

  if (generatedAudio && humanWords) {
    headline = 'Written by a person, over a machine-generated recording.'
    filingNote =
      'This is the split the Copyright Office cares about. The lyrics are claimable as your authorship; the sound recording should be disclaimed as machine-generated. Fix the words in the authorship record below so the claim is evidenced rather than merely asserted.'
  } else if (generatedAudio && generatedWords) {
    headline = 'Both the recording and the writing carry markers of generation.'
    filingNote =
      'Nothing here supports a claim of human authorship in either the recording or the words. If you wrote the lyrics, the record below is what establishes that — this reading looks at style, and style is not provenance.'
  } else if (recordedAudio && humanWords) {
    headline = 'Written by a person, on a recording that looks captured.'
    filingNote =
      'Both sides point the same way. Nothing here indicates material that would need disclaiming, though the Office makes its own determination and absence of a finding is not proof of absence.'
  } else if (recordedAudio) {
    headline = 'The recording looks captured; the writing is not established.'
    filingNote =
      'Read the lyrics into the scan to complete this. Without them only half the work has been examined.'
  } else if (generatedAudio) {
    headline = 'The recording looks machine-generated; the writing is not established.'
    filingNote =
      'The sound recording should be disclaimed. Whether you can claim the words is a separate question this reading has not answered — read the lyrics in, and fix them in the record below.'
  } else {
    headline = 'Not established either way.'
    filingNote =
      'This examination did not reach a finding. Do not treat that as evidence of anything: it means the measurements were inconclusive, which is common and is not a verdict.'
  }

  caveats.push(
    'This states measurements and the conclusions drawn from them. It is not legal advice, and the Copyright Office determines every application itself.',
  )

  return { headline, recording, lyrics: lyricSide, filingNote, caveats }
}
