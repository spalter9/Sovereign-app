import { analyseContainer } from './container'
import { clearsAllPlatforms, evaluateDelivery, type DeliveryVerdict } from './delivery-targets'
import { FEATURE_EXTRACTORS } from './features'
import { separate, type SourceName } from './separate'
import { measureNoiseFloor, readNoiseFloor, type FloorVerdict } from './provenance'
import {
  authorshipIndex,
  claimEligibility,
  overallVerdict,
  scoreStem,
  STEM_GROUP,
} from './scoring'
import type { AudioBuffer32 } from './audio-types'
import type {
  ClaimEligibility,
  ContainerReport,
  ExaminerStem,
  OverallVerdict,
  StemAnalysis,
  UscoFilingDossier,
} from './types'

/**
 * The examiner: separation, measurement, scoring and the filing language,
 * end to end, in the browser.
 */

export type SourceFinding = {
  source: SourceName
  group: ExaminerStem
  energyShare: number
}

export type ExaminerFinding = {
  fileName: string
  sha256: string
  durationSec: number
  sampleRate: number
  channels: number
  container: ContainerReport
  delivery: DeliveryVerdict[]
  clearsDelivery: boolean
  stems: StemAnalysis[]
  sources: SourceFinding[]
  authorshipIndex: number
  verdict: OverallVerdict
  eligibility: ClaimEligibility
  dossier: UscoFilingDossier
  /** Share of total feature weight actually measured, per group. */
  evidence: Record<string, number>
  /**
   * Noise-floor provenance, reported on its own.
   *
   * Deliberately not folded into the authorship index: the performance
   * features that index is built from were tested against tracks of known
   * provenance and separated nothing, while this one did. Averaging a signal
   * that works into several that do not would hide both facts.
   */
  floor: FloorVerdict
  separation: 'browser_hpss'
}

export type Progress = (stage: string, fraction: number) => void

const GROUP_LABEL: Record<ExaminerStem, string> = {
  vocals: 'the vocal performance',
  drums: 'the rhythmic and percussion elements',
  bass_and_harmony: 'the bass and harmonic arrangement',
}

/**
 * Draft the limitation of claim.
 *
 * 17 U.S.C. 409(9) requires an applicant to identify pre-existing material
 * excluded from the claim, and the Office's 2023 guidance treats
 * machine-generated material as exactly that. What is written here is the
 * sentence a filer pastes into the application, built only from groups the
 * examiner actually reached a verdict on — an unscored group is named as
 * undetermined rather than quietly claimed.
 */
function draftDossier(stems: StemAnalysis[]): UscoFilingDossier {
  const excluded = stems.filter((s) => s.copyright_status === 'MUST_EXCLUDE')
  const partial = stems.filter((s) => s.copyright_status === 'PARTIAL_CLAIM')
  const claimable = stems.filter((s) => s.copyright_status === 'CLAIMABLE')
  const undetermined = stems.filter((s) => s.copyright_status === 'UNDETERMINED')

  const list = (items: StemAnalysis[]) =>
    items.map((s) => GROUP_LABEL[s.stem]).join(', ').replace(/, ([^,]*)$/, ' and $1')

  const materialExcluded = excluded.length
    ? `Machine-generated material in ${list(excluded)}.`
    : 'No material identified for exclusion on the evidence measured.'

  const included = [...claimable, ...partial]
  const newMaterial = included.length
    ? `Original human authorship in ${list(included)}${
        partial.length ? ', in part' : ''
      }, together with the selection and arrangement of the sound recording as fixed.`
    : 'No group reached the threshold for an affirmative claim of human authorship.'

  const sentences: string[] = []
  if (excluded.length) {
    sentences.push(
      `Applicant expressly disclaims copyright in machine-generated material comprising ${list(
        excluded,
      )}.`,
    )
  }
  if (included.length) {
    sentences.push(
      `Applicant claims ${list(included)}, and the sound recording as fixed, as original human authorship.`,
    )
  }
  if (undetermined.length) {
    sentences.push(
      `Authorship of ${list(undetermined)} was not determined on the available evidence and is not claimed here.`,
    )
  }

  return {
    material_excluded: materialExcluded,
    new_material_included: newMaterial,
    eCO_copy_paste_text: sentences.join(' '),
    limitation_required: excluded.length > 0 || partial.length > 0,
    claim_blocked: included.length === 0,
  }
}

function planarOf(audio: AudioBuffer32): Float64Array[] {
  const planar: Float64Array[] = []
  for (let ch = 0; ch < audio.channels; ch += 1) {
    const out = new Float64Array(audio.length)
    for (let i = 0; i < audio.length; i += 1) out[i] = audio.samples[i * audio.channels + ch]!
    planar.push(out)
  }
  return planar
}

export function examine(
  audio: AudioBuffer32,
  meta: { fileName: string; sha256: string },
  onProgress?: Progress,
): ExaminerFinding {
  onProgress?.('Measuring the container', 0.02)
  const container = analyseContainer(audio)
  const delivery = evaluateDelivery(container.integrated_lufs, container.true_peak_dbtp)

  const planar = planarOf(audio)
  const separation = separate(planar, audio.sampleRate, (stage, fraction) =>
    onProgress?.(stage, 0.05 + fraction * 0.5),
  )

  // Measure each separated source with the extractor for its kind.
  const sources: SourceFinding[] = []
  const measuredByGroup = new Map<ExaminerStem, Record<string, number>>()
  const shareByGroup = new Map<ExaminerStem, number>()

  const names: SourceName[] = ['vocals', 'drums', 'bass', 'other']
  names.forEach((name, index) => {
    onProgress?.(`Examining ${name}`, 0.6 + (index / names.length) * 0.3)
    const source = separation[name]
    const group = STEM_GROUP[name]
    sources.push({ source: name, group, energyShare: source.energyShare })

    const measured = FEATURE_EXTRACTORS[name](source.channels, audio.sampleRate)
    // bass and other share a group; the louder source decides its features so
    // a near-silent one cannot dilute a real reading.
    const existingShare = shareByGroup.get(group) ?? 0
    if (!measuredByGroup.has(group) || source.energyShare > existingShare) {
      const numeric: Record<string, number> = {}
      for (const [key, value] of Object.entries(measured)) {
        if (value !== null && Number.isFinite(value)) numeric[key] = value
      }
      measuredByGroup.set(group, numeric)
    }
    shareByGroup.set(group, existingShare + source.energyShare)
  })

  onProgress?.('Scoring', 0.92)
  const stems: StemAnalysis[] = []
  const evidence: Record<string, number> = {}
  for (const [group, measured] of measuredByGroup) {
    const stem = scoreStem(group, measured, shareByGroup.get(group) ?? 0)
    stems.push(stem)
    evidence[group] = stem.features.reduce((sum, f) => sum + f.weight, 0)
  }

  const index = authorshipIndex(stems)

  onProgress?.('Reading the noise floor', 0.95)
  const floor = readNoiseFloor(measureNoiseFloor(planar, audio.sampleRate))

  onProgress?.('Drafting the limitation of claim', 0.97)
  return {
    floor,
    fileName: meta.fileName,
    sha256: meta.sha256,
    durationSec: audio.length / audio.sampleRate,
    sampleRate: audio.sampleRate,
    channels: audio.channels,
    container,
    delivery,
    clearsDelivery: clearsAllPlatforms(delivery),
    stems,
    sources,
    authorshipIndex: index,
    verdict: overallVerdict(index, stems),
    eligibility: claimEligibility(index, stems),
    dossier: draftDossier(stems),
    evidence,
    separation: 'browser_hpss',
  }
}
