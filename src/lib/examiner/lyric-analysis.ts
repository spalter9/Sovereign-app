/**
 * Stylometry for lyrics: does this text read as written by a person or by a
 * language model?
 *
 * There is no way to prove authorship of text from the text alone, and this
 * does not claim to. What it does is measure properties that differ
 * measurably between the two populations and report each one with its
 * evidence, so a reader can see why the score came out where it did rather
 * than being handed a number.
 *
 * The properties are the ones that survive scrutiny:
 *
 * - Specificity. People write about a particular Tuesday, a particular bar, a
 *   named person. Generated lyrics stay abstract because abstraction is the
 *   safest continuation — they reach for "the night" rather than "the 2 a.m.
 *   bus on Sherman Avenue".
 * - Collocation. A model completes into the highest-probability next phrase,
 *   which is why generated lyrics are dense with pairings like "shattered
 *   dreams" and "burning bright" that a writer would hear as tired.
 * - Regularity. Lines from a model come out close to the same length with
 *   clean end-rhyme. A writer's lines vary and often use slant rhyme or none.
 * - Burstiness. Human writing varies its sentence complexity sharply;
 *   generated text is far more uniform.
 *
 * Every one of those is a tendency, not a rule. A deliberately abstract
 * human lyric will score low. That is why the output is a leaning with its
 * reasoning attached, and why it never says "written by AI".
 */

export type LyricFeature = {
  id: string
  label: string
  /** Raw measured value. */
  value: number
  unit: string
  /** 0 = looks generated, 1 = looks human-written. */
  score: number
  weight: number
  reading: string
}

export type LyricAnalysis = {
  features: LyricFeature[]
  /** Weighted score, 0-1. Higher leans human-written. */
  index: number
  leaning: 'reads_human_written' | 'reads_generated' | 'inconclusive'
  wordCount: number
  lineCount: number
  /** True when there is too little text to say anything. */
  tooShort: boolean
  note: string
}

/** Pairings a language model reaches for and a writer usually does not. */
const TIRED_COLLOCATIONS = [
  'shattered dream', 'broken dream', 'burning bright', 'endless night', 'neon light',
  'shadows fall', 'tears fall', 'heart of gold', 'sands of time', 'break the chain',
  'rise above', 'fade away', 'slipping away', 'hold me close', 'take my hand',
  'never let go', 'through the storm', 'weight of the world', 'silent scream',
  'frozen in time', 'lost in the moment', 'chasing dreams', 'higher and higher',
  'burning flame', 'flicker of hope', 'dancing in the', 'stars align', 'echoes of',
  'whisper in the wind', 'city lights', 'concrete jungle', 'paper thin',
  'crashing down', 'falling apart', 'piece by piece', 'shattered glass',
  'demons inside', 'fighting the night', 'light in the dark', 'beacon of',
  'against all odds', 'nothing left to', 'end of the line', 'road ahead',
]

/** Rhyme pairs so common they signal a completion engine rather than a choice. */
const STOCK_RHYMES = [
  ['fire', 'desire'], ['heart', 'apart'], ['night', 'light'], ['night', 'right'],
  ['pain', 'rain'], ['cry', 'why'], ['sky', 'high'], ['sky', 'fly'],
  ['away', 'stay'], ['away', 'day'], ['believe', 'leave'], ['tears', 'years'],
  ['alone', 'stone'], ['soul', 'whole'], ['dreams', 'seems'], ['时', 'x'],
]

const FUNCTION_WORDS = new Set([
  'the','a','an','and','or','but','if','of','to','in','on','at','for','with','as',
  'is','are','was','were','be','been','am','it','its','this','that','these','those',
  'i','you','he','she','we','they','me','him','her','us','them','my','your','his',
  'our','their','so','then','than','too','very','just','all','no','not','do','does',
])

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g) ?? []
}

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    // Section markers like [Verse 1] are structure, not writing.
    .filter((l) => l.length > 0 && !/^[[(].*[\])]$/.test(l))
}

/** Crude but stable syllable count — enough to compare line lengths. */
function syllables(word: string): number {
  const w = word.replace(/[^a-z]/g, '')
  if (!w) return 0
  const groups = w.replace(/e$/, '').match(/[aeiouy]+/g)
  return Math.max(1, groups ? groups.length : 1)
}

function lastWord(line: string): string {
  const w = words(line)
  return w.length ? w[w.length - 1]! : ''
}

/**
 * Do two words rhyme, roughly? Compares the tail from the final vowel.
 *
 * The tail must start at the *last* vowel, not the first. A pattern like
 * /[aeiouy][a-z]*$/ matches from the earliest vowel it finds, so "confined"
 * yields "onfined" and fails to rhyme with "behind" — which quietly reduced
 * this whole feature to detecting only single-vowel words.
 */
function rhymes(a: string, b: string): boolean {
  if (!a || !b || a === b) return false
  const tail = (w: string) => {
    const clean = w.replace(/[^a-z]/g, '')
    let last = -1
    for (let i = clean.length - 1; i >= 0; i -= 1) {
      if ('aeiouy'.includes(clean[i]!)) {
        last = i
        break
      }
    }
    if (last < 0) return clean.slice(-2)
    // A trailing silent -e carries no rhyme: "confined" and "behind" agree on
    // "ind" once it is dropped.
    const from = clean.slice(last)
    return from.length > 2 && from.endsWith('e') ? from.slice(0, -1) : from
  }
  const ta = tail(a)
  const tb = tail(b)
  if (ta.length < 2 || tb.length < 2) return false
  if (ta === tb) return true
  // "night"/"bright" agree on "ight"; allow one to be a suffix of the other
  // so "grow"/"go" and "stay"/"away" also count.
  return ta.length >= 2 && tb.length >= 2 && (ta.endsWith(tb) || tb.endsWith(ta))
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Piecewise-linear score: `low` maps to 0, `high` maps to 1. */
function ramp(v: number, low: number, high: number): number {
  if (high === low) return 0.5
  return clamp01((v - low) / (high - low))
}

/**
 * Collapse repeated lines to one occurrence.
 *
 * A chorus sung four times is one piece of writing, not four. Left in, the
 * repeats drive line-length variance and vocabulary reach through the floor
 * and every refrain-driven song — which is most songs — measures as
 * machine-regular.
 */
function withoutRefrains(ls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of ls) {
    const key = line.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    out.push(line)
  }
  return out
}

export function analyseLyrics(raw: string): LyricAnalysis {
  const text = raw.trim()
  const allLines = lines(text)
  const ls = withoutRefrains(allLines)
  const ws = words(ls.join('\n'))

  if (ws.length < 40 || ls.length < 4) {
    return {
      features: [],
      index: 0,
      leaning: 'inconclusive',
      wordCount: ws.length,
      lineCount: allLines.length,
      tooShort: true,
      note: 'Too little text to read. Stylometry needs roughly forty words and four lines before any of it means anything.',
    }
  }

  const features: LyricFeature[] = []

  // ── specificity: proper nouns, numbers, concrete particulars ──────────
  const properNouns = (text.match(/(?<![.!?]\s)(?<!^)\b[A-Z][a-z]{2,}\b/gm) ?? []).length
  const numbers = (text.match(/\b\d+\b/g) ?? []).length
  const specificity = ((properNouns + numbers) / ws.length) * 100
  features.push({
    id: 'specificity',
    label: 'Named and numbered particulars',
    value: specificity,
    unit: 'per 100 words',
    score: ramp(specificity, 0.2, 2.5),
    weight: 0.24,
    reading:
      specificity >= 1.5
        ? `${specificity.toFixed(2)} per 100 words — names and numbers a writer reached for`
        : specificity <= 0.4
          ? `${specificity.toFixed(2)} per 100 words — almost nothing particular is named`
          : `${specificity.toFixed(2)} per 100 words — some particulars`,
  })

  // ── collocation density ───────────────────────────────────────────────
  const lower = text.toLowerCase()
  let tired = 0
  for (const phrase of TIRED_COLLOCATIONS) {
    let from = 0
    for (;;) {
      const at = lower.indexOf(phrase, from)
      if (at < 0) break
      tired += 1
      from = at + phrase.length
    }
  }
  const tiredPer100 = (tired / ws.length) * 100
  features.push({
    id: 'collocation',
    label: 'High-probability phrasing',
    value: tiredPer100,
    unit: 'per 100 words',
    // Inverted: more stock phrasing reads as generated.
    score: 1 - ramp(tiredPer100, 0.2, 2.0),
    weight: 0.22,
    reading:
      tiredPer100 >= 1.2
        ? `${tiredPer100.toFixed(2)} per 100 words — dense with the phrase a completion engine reaches for`
        : tiredPer100 <= 0.3
          ? `${tiredPer100.toFixed(2)} per 100 words — little stock phrasing`
          : `${tiredPer100.toFixed(2)} per 100 words — some stock phrasing`,
  })

  // ── line-length regularity ────────────────────────────────────────────
  const sylPerLine = ls.map((l) => words(l).reduce((a, w) => a + syllables(w), 0))
  const meanSyl = sylPerLine.reduce((a, b) => a + b, 0) / sylPerLine.length
  const sdSyl = Math.sqrt(
    sylPerLine.reduce((a, b) => a + (b - meanSyl) ** 2, 0) / sylPerLine.length,
  )
  const lineCv = meanSyl > 0 ? sdSyl / meanSyl : 0
  features.push({
    id: 'line_variance',
    label: 'Line-length variation',
    value: lineCv,
    unit: 'cv',
    score: ramp(lineCv, 0.12, 0.45),
    weight: 0.18,
    reading:
      lineCv <= 0.15
        ? `syllable CV ${lineCv.toFixed(3)} — lines come out near-identical in length`
        : `syllable CV ${lineCv.toFixed(3)} — lines vary the way spoken phrasing does`,
  })

  // ── rhyme regularity ──────────────────────────────────────────────────
  // Score the schemes a lyric actually uses, and take the best fit.
  //
  // Counting every overlapping adjacent pair cannot work: in a perfect AABB
  // couplet scheme the second and third lines do not rhyme with each other,
  // so the rate caps at about half however tight the writing is, and ABAB
  // scores near zero. Measured that way the most rigidly rhymed lyric reads
  // as loose — the opposite of what the feature is for.
  const ends = ls.map((l) => lastWord(l)).filter((w) => w.length > 0)
  const isStock = (a: string, b: string) =>
    STOCK_RHYMES.some(([x, y]) => (a === x && b === y) || (a === y && b === x))

  const scheme = (offsetPairs: [number, number][]): { rate: number; stock: number } => {
    let hit = 0
    let st = 0
    let n = 0
    for (const [i, j] of offsetPairs) {
      const a = ends[i]
      const b = ends[j]
      if (!a || !b) continue
      n += 1
      if (rhymes(a, b)) {
        hit += 1
        if (isStock(a, b)) st += 1
      }
    }
    return { rate: n > 0 ? hit / n : 0, stock: st }
  }

  const couplets: [number, number][] = []
  const alternating: [number, number][] = []
  for (let i = 0; i + 1 < ends.length; i += 2) couplets.push([i, i + 1])
  for (let i = 0; i + 3 < ends.length; i += 4) {
    alternating.push([i, i + 2])
    alternating.push([i + 1, i + 3])
  }
  const aabb = scheme(couplets)
  const abab = scheme(alternating)
  const best = abab.rate > aabb.rate ? abab : aabb
  const rhymeRate = best.rate
  const stock = best.stock
  features.push({
    id: 'rhyme',
    label: 'End-rhyme regularity',
    value: rhymeRate,
    unit: 'ratio',
    // Very high adjacent-rhyme rates read as generated; moderate reads human.
    score: 1 - ramp(rhymeRate, 0.45, 0.9),
    weight: 0.16,
    reading:
      rhymeRate >= 0.6
        ? `${(rhymeRate * 100).toFixed(0)}% of adjacent lines rhyme cleanly${stock ? `, ${stock} on stock pairs` : ''} — a very regular scheme`
        : `${(rhymeRate * 100).toFixed(0)}% of adjacent lines rhyme — irregular or slant`,
  })

  // ── burstiness: variation in content-word density line to line ────────
  const density = ls.map((l) => {
    const lw = words(l)
    if (lw.length === 0) return 0
    return lw.filter((w) => !FUNCTION_WORDS.has(w)).length / lw.length
  })
  const meanD = density.reduce((a, b) => a + b, 0) / density.length
  const sdD = Math.sqrt(density.reduce((a, b) => a + (b - meanD) ** 2, 0) / density.length)
  features.push({
    id: 'burstiness',
    label: 'Density variation between lines',
    value: sdD,
    unit: 'sd',
    score: ramp(sdD, 0.05, 0.22),
    weight: 0.10,
    reading:
      sdD <= 0.08
        ? `sd ${sdD.toFixed(3)} — every line carries much the same weight`
        : `sd ${sdD.toFixed(3)} — weight shifts sharply between lines`,
  })

  // ── vocabulary reach ──────────────────────────────────────────────────
  const unique = new Set(ws).size
  // Normalised for length: type-token ratio falls with word count on its own.
  const ttr = unique / Math.sqrt(ws.length)
  features.push({
    id: 'vocabulary',
    label: 'Vocabulary reach',
    value: ttr,
    unit: 'root ttr',
    score: ramp(ttr, 3.5, 8.0),
    weight: 0.10,
    reading: `root type-token ratio ${ttr.toFixed(2)} over ${unique} distinct words`,
  })

  const total = features.reduce((a, f) => a + f.weight, 0)
  const index = features.reduce((a, f) => a + f.score * f.weight, 0) / total

  /*
   * The two directions are not symmetric, and treating them as if they were
   * is what makes a lyric detector dangerous.
   *
   * Naming a street or a year is positive evidence a person wrote this. Not
   * naming one is evidence of almost nothing — plenty of human songs are
   * deliberately abstract, and a plain repeated chorus is the shape of most
   * hit records ever written. Scored symmetrically, "Baby I don't wanna go"
   * comes out looking machine-made, and a tool that says so about someone's
   * own song has done real damage in exchange for nothing.
   *
   * So a generated call requires the *presence* of generation markers —
   * stock phrasing, rigid metre, stock rhyme — and not merely the absence of
   * human ones. Everything short of that is inconclusive, which is a cheap
   * error where a false accusation is an expensive one.
   */
  const collocation = features.find((f) => f.id === 'collocation')!
  const lineVariance = features.find((f) => f.id === 'line_variance')!
  const rhyme = features.find((f) => f.id === 'rhyme')!
  const specificityFeature = features.find((f) => f.id === 'specificity')!

  // Each marker must be positively present, not just unremarkable.
  const generationMarkers =
    (collocation.value >= 0.8 ? 1 : 0) +
    (lineVariance.value <= 0.12 ? 1 : 0) +
    (rhyme.value >= 0.6 ? 1 : 0)

  const leaning =
    index >= 0.62 && specificityFeature.value > 0.4
      ? 'reads_human_written'
      : generationMarkers >= 2 && index <= 0.42
        ? 'reads_generated'
        : 'inconclusive'

  const note =
    leaning === 'reads_human_written'
      ? 'The writing names particulars and varies its phrasing in ways generated lyrics tend not to.'
      : leaning === 'reads_generated'
        ? `Positive markers of generation are present: ${[
            collocation.value >= 0.8 ? 'dense stock phrasing' : null,
            lineVariance.value <= 0.12 ? 'near-uniform line lengths' : null,
            rhyme.value >= 0.6 ? 'a rigid rhyme scheme' : null,
          ]
            .filter(Boolean)
            .join(', ')}.`
        : 'Nothing here points firmly either way. Abstract or repetitive writing is ordinary in songs, so its absence of particulars is not treated as evidence of a machine.'

  return {
    features,
    index,
    leaning,
    wordCount: ws.length,
    lineCount: allLines.length,
    tooShort: false,
    note,
  }
}
