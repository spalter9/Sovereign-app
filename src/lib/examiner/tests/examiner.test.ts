/**
 * Invariants for the browser examiner.
 *
 * Run with: npm run test:examiner
 *
 * These are the properties that must not silently regress. Several of them
 * encode bugs that were live during development and would have produced
 * confident, wrong findings: onsets landing 150 ms early, edge artefacts
 * dominating energy share, an anti-phase pad classified as a centred vocal.
 */

import { istft, stft } from '../stft'
import { separate } from '../separate'
import { onsetGridDeviation, spectralCliffHz } from '../features'
import { estimateTempo, onsetStrength, refineOnsets, detectOnsets, trackF0, lpc, lpcFormants } from '../analysis'
import { HOP } from '../stft'
import { measureNoiseFloor, readNoiseFloor, scoreProvenance, spectralFluxSd, scoreTrackProvenance } from '../provenance'
import { normaliseLyrics, recordLyrics, verifyRecord } from '../lyrics'
import { analyseLyrics } from '../lyric-analysis'
import { segmentLines, assessTranscript } from '../transcribe'

const SR = 44100
let failures = 0
let checks = 0

function pass(name: string, condition: boolean, detail = '') {
  checks += 1
  if (condition) {
    console.log(`  PASS  ${name}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function rms(x: Float64Array) {
  let s = 0
  for (const v of x) s += v * v
  return Math.sqrt(s / x.length)
}

// ── transform ────────────────────────────────────────────────────────────
{
  const n = SR * 2
  const sig = new Float64Array(n)
  for (let i = 0; i < n; i += 1) {
    sig[i] = Math.sin((2 * Math.PI * 440 * i) / SR) * 0.5 + Math.sin((2 * Math.PI * 97 * i) / SR) * 0.3
  }
  const back = istft(stft(sig, SR), n)
  let err = 0
  let ref = 0
  for (let i = 8192; i < n - 8192; i += 1) {
    err += (back[i]! - sig[i]!) ** 2
    ref += sig[i]! ** 2
  }
  const relative = Math.sqrt(err / ref)
  pass('STFT round trip is exact in the interior', relative < 1e-9, `relative error ${relative.toExponential(2)}`)

  // The edges must not be amplified: flooring the overlap-add divisor is what
  // stops a burst of artefact dominating every downstream measurement.
  let peak = 0
  for (let i = 0; i < n; i += 1) if (Math.abs(back[i]!) > peak) peak = Math.abs(back[i]!)
  pass('reconstruction never amplifies beyond the input', peak <= 1.05, `peak ${peak.toFixed(3)}`)
}

// ── separation ───────────────────────────────────────────────────────────
{
  const n = SR * 4
  const L = new Float64Array(n)
  const R = new Float64Array(n)
  for (let i = 0; i < n; i += 1) {
    const t = i / SR
    const ph = t % 0.25
    const perc = ph < 0.02 ? (Math.sin(2 * Math.PI * 2500 * ph) + Math.sin(2 * Math.PI * 5500 * ph)) * Math.exp(-ph / 0.006) * 0.9 : 0
    const vox = Math.sin(2 * Math.PI * 330 * t) * 0.4
    const bass = Math.sin(2 * Math.PI * 70 * t) * 0.4
    const pad = Math.sin(2 * Math.PI * 880 * t) * 0.25
    L[i] = vox + bass + perc + pad
    R[i] = vox + bass + perc - pad
  }
  const s = separate([L, R], SR)

  // Masks partition the signal, so the parts must sum back to the whole.
  const sum = new Float64Array(n)
  for (const k of ['vocals', 'drums', 'bass', 'other'] as const) {
    for (let i = 0; i < n; i += 1) sum[i] += s[k].channels[0]![i]!
  }
  let err = 0
  let ref = 0
  for (let i = 8192; i < n - 8192; i += 1) {
    err += (sum[i]! - L[i]!) ** 2
    ref += L[i]! ** 2
  }
  pass('separated sources sum back to the input', Math.sqrt(err / ref) < 1e-9)

  const shares = Object.fromEntries(
    (['vocals', 'drums', 'bass', 'other'] as const).map((k) => [k, s[k].energyShare]),
  )
  pass('energy shares total one', Math.abs(Object.values(shares).reduce((a, b) => a + b, 0) - 1) < 1e-6)
  pass('a centred tone lands in vocals', shares.vocals! > 0.25, `share ${shares.vocals!.toFixed(3)}`)
  pass('a low tone lands in bass', shares.bass! > 0.25, `share ${shares.bass!.toFixed(3)}`)
  // Equal magnitudes do not mean centred: this fails if centre detection ever
  // goes back to comparing magnitudes instead of phase.
  pass('an anti-phase pad is not mistaken for a centred vocal', shares.other! > 0.05, `other ${shares.other!.toFixed(3)}`)
  pass('no source is louder than the programme', (['vocals','drums','bass','other'] as const).every((k) => rms(s[k].channels[0]!) <= rms(L) * 1.5))
}

// ── onset timing ─────────────────────────────────────────────────────────
{
  const beat = 0.3
  const dur = 20
  const n = Math.round(SR * dur)
  const truth: number[] = []
  const x = new Float64Array(n)
  for (let t = 0.5; t < dur - 1; t += beat) {
    truth.push(t)
    for (let i = Math.round(t * SR); i < Math.min(n, Math.round((t + 0.1) * SR)); i += 1) {
      const tt = (i - t * SR) / SR
      x[i] += Math.sin(2 * Math.PI * 1500 * tt) * Math.exp(-tt / 0.01) * 0.7
    }
  }
  const env = onsetStrength(stft(x, SR))
  const tempo = estimateTempo(env, SR)!
  pass('tempo is within two percent', Math.abs(tempo - 200) / 200 < 0.02, `${tempo.toFixed(1)} BPM`)

  const grid = 60 / tempo / 4
  const coarse = detectOnsets(env, SR, Math.max(1, Math.round(((grid / 2) * SR) / HOP)))
  const fine = refineOnsets(x, SR, coarse)
  const errors = fine.slice(0, truth.length).map((v, i) => Math.abs(v - truth[i]!) * 1000)
  const mean = errors.reduce((a, b) => a + b, 0) / errors.length
  // Frames are not centred, so a coarse onset sits early by up to a window.
  // If refinement ever stops searching forward this jumps back to ~150 ms.
  pass('refined onsets land within 5 ms of truth', mean < 5, `mean ${mean.toFixed(2)} ms`)

  const quantised = onsetGridDeviation(x, SR).deviationMs!
  pass('perfectly quantised material measures under 2 ms of deviation', quantised < 2, `${quantised.toFixed(2)} ms`)
}

// Measured timing must track injected timing.
{
  const build = (jitterMs: number) => {
    const beat = 0.3
    const dur = 20
    const n = Math.round(SR * dur)
    const out = new Float64Array(n)
    let s = 9
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s / 0x7fffffff)
    for (let t = 0.5; t < dur - 1; t += beat) {
      const on = t + (rnd() - 0.5) * 2 * (jitterMs / 1000)
      for (let i = Math.round(on * SR); i < Math.min(n, Math.round((on + 0.1) * SR)); i += 1) {
        const tt = (i - on * SR) / SR
        out[i] += Math.sin(2 * Math.PI * 1500 * tt) * Math.exp(-tt / 0.01) * 0.7
      }
    }
    return out
  }
  const tight = onsetGridDeviation(build(2), SR).deviationMs!
  const loose = onsetGridDeviation(build(20), SR).deviationMs!
  pass('looser playing measures as looser', loose > tight * 3, `${tight.toFixed(2)} vs ${loose.toFixed(2)} ms`)
  pass('measured deviation approximates the injected spread', Math.abs(loose - 20 / Math.sqrt(3)) < 3, `${loose.toFixed(2)} ms`)
}

// ── pitch ────────────────────────────────────────────────────────────────
{
  for (const hz of [110, 440]) {
    const n = SR * 2
    const x = new Float64Array(n)
    for (let i = 0; i < n; i += 1) x[i] = Math.sin((2 * Math.PI * hz * i) / SR) * 0.5
    const { f0, voiced } = trackF0(x, SR, 65, 2100)
    const vals: number[] = []
    for (let i = 0; i < f0.length; i += 1) if (voiced[i]) vals.push(f0[i]!)
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    pass(`f0 of a ${hz} Hz tone is within 15 cents`, Math.abs(1200 * Math.log2(mean / hz)) < 15)
    const med = vals.slice().sort((a, b) => a - b)[vals.length >> 1]!
    const spread = Math.sqrt(vals.map((v) => (1200 * Math.log2(v / med)) ** 2).reduce((a, b) => a + b, 0) / vals.length)
    // A fixed-pitch source must read as fixed, or every synthetic track looks
    // like it was sung.
    pass(`a fixed ${hz} Hz tone shows no drift`, spread < 1, `${spread.toFixed(3)} cents`)
  }
}

// ── formants ─────────────────────────────────────────────────────────────
{
  const frame = new Float64Array(1024)
  for (let i = 0; i < 1024; i += 1) {
    frame[i] = (Math.sin((2 * Math.PI * 700 * i) / SR) * 0.5 + Math.sin((2 * Math.PI * 1900 * i) / SR) * 0.3) *
      (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / 1023))
  }
  const coeffs = lpc(frame, 46)
  pass('LPC solves on a clean frame', coeffs !== null)
  const formants = coeffs ? lpcFormants(coeffs, SR) : []
  pass('formants land on the true resonances',
    formants.length >= 2 && Math.abs(formants[0]! - 700) < 60 && Math.abs(formants[1]! - 1900) < 60,
    formants.slice(0, 2).map((f) => f.toFixed(0)).join(', '))
}

// ── spectral cliff ───────────────────────────────────────────────────────
{
  const n = SR * 2
  const noise = new Float64Array(n)
  for (let i = 0; i < n; i += 1) noise[i] = (Math.random() * 2 - 1) * 0.5

  // A brick-wall limit, applied in the frequency domain. A one-pole filter
  // rolls off six dB per octave and never falls forty dB below the reference
  // band, so it has no cliff to find — the codec artefact this feature exists
  // to catch is a hard edge, and that is what the test must present.
  const spec = stft(noise, SR)
  const cutoffBin = Math.round((6000 / (SR / 2)) * (spec.bins - 1))
  for (let f = 0; f < spec.frames; f += 1) {
    for (let k = cutoffBin; k < spec.bins; k += 1) {
      spec.re[f]![k] = 0
      spec.im[f]![k] = 0
    }
  }
  const band = istft(spec, n)
  const cliff = spectralCliffHz(band, SR)
  pass(
    'spectral cliff finds a hard band limit',
    cliff !== null && cliff > 4000 && cliff < 9000,
    `${cliff?.toFixed(0)} Hz (true 6000)`,
  )
}

// ── noise-floor provenance ───────────────────────────────────────────────
// The one signal that separated real material. Synthesised noise of known
// colour stands in for the two populations: pink for a physical capture,
// white for synthesis residual.
{
  const n = SR * 12
  const white: Float64Array[] = [new Float64Array(n), new Float64Array(n)]
  const pink: Float64Array[] = [new Float64Array(n), new Float64Array(n)]
  // Voss-McCartney-ish pink by summing octave-spaced smoothed noise.
  const states = new Float64Array(12)
  for (let c = 0; c < 2; c += 1) {
    states.fill(0)
    for (let i = 0; i < n; i += 1) {
      const w = Math.random() * 2 - 1
      white[c]![i] = w * 0.02
      let sum = 0
      for (let k = 0; k < 12; k += 1) {
        if (i % (1 << k) === 0) states[k] = Math.random() * 2 - 1
        sum += states[k]!
      }
      pink[c]![i] = (sum / 12) * 0.02
    }
  }
  const whiteRead = readNoiseFloor(measureNoiseFloor(white, SR))
  const pinkRead = readNoiseFloor(measureNoiseFloor(pink, SR))
  // Pink is -0.5 on an amplitude spectrum, which is the *generated* side of
  // the observed boundary — recorded floors measured steeper than pink, not
  // shallower. These assert the ordering and the direction, not a colour.
  pass('a flat floor does not read as a physical capture', whiteRead.resembles !== 'recorded',
    `${whiteRead.resembles} at slope ${whiteRead.reading.slope?.toFixed(2)}`)
  pass('pink measures steeper than white', (pinkRead.reading.slope ?? 0) < (whiteRead.reading.slope ?? 0),
    `${pinkRead.reading.slope?.toFixed(2)} vs ${whiteRead.reading.slope?.toFixed(2)}`)
  pass('pink alone is not steep enough to read as recorded', pinkRead.resembles !== 'recorded',
    `${pinkRead.resembles} at slope ${pinkRead.reading.slope?.toFixed(2)}`)
  pass('silence yields no floor reading', readNoiseFloor(
    measureNoiseFloor([new Float64Array(SR * 8), new Float64Array(SR * 8)], SR)).resembles === 'inconclusive')
}

// ── lyric authorship record ──────────────────────────────────────────────
{
  const raw = '  I kept the receipts\r\n\n\n\n  of everything you said  \n'
  pass('normalisation is stable across re-typing',
    normaliseLyrics(raw) === normaliseLyrics('I kept the receipts\n\nof everything you said'))

  const audioHash = 'a'.repeat(64)
  const fixedAt = '2026-01-01T00:00:00.000Z'
  const record = await recordLyrics({
    raw,
    audioHash,
    fixedAt,
    posture: { lyricsAuthored: true, recordingGenerated: true, musicAuthored: false },
  })
  pass('a record verifies against itself', await verifyRecord(record))
  pass('the record claims the lyrics', /claims the lyrics/.test(record.eCoText))
  pass('the record disclaims the recording', /disclaims copyright in the sound recording/.test(record.eCoText))
  // The drafted sentence must read as English: an earlier version emitted a
  // doubled relative clause here.
  pass('the drafted sentence has no doubled clause', !/which is machine-generated, which/.test(record.eCoText))

  // Swapping either side must break the binding, or the record proves nothing.
  pass('altered lyrics break the record', !(await verifyRecord({ ...record, text: record.text + ' extra' })))
  pass('a swapped recording breaks the binding',
    !(await verifyRecord({ ...record, audioHash: 'b'.repeat(64) })))

  const same = await recordLyrics({ raw, audioHash, fixedAt, posture: record.posture })
  pass('the same inputs produce the same record', same.crossHash === record.crossHash)
}

// ── lyric stylometry ─────────────────────────────────────────────────────
{
  const generated = `I'm walking through the endless night
Chasing dreams that burn so bright
Every shadow falls behind
Leaving all my fears confined

Hold me close and never let go
Through the storm we'll rise and grow
Shattered dreams will fade away
In your arms I'll always stay

City lights are burning bright
Guiding me toward the light
Piece by piece I'm falling apart
But you're the healer of my heart`

  const human = `She kept the Metro card from 2011
in the drawer with the batteries that don't work
I said that's junk, she said it's Tuesday
and I didn't have an answer for that

We ate at the Wan Fu on Sherman
because the good place was closed on Mondays
and she ordered for both of us like always
and I let her, because she's usually right

Now the drawer's mine and the card's still in it
and the batteries still don't work
and I keep meaning to throw all of it out
and I keep not doing it`

  const g = analyseLyrics(generated)
  const h = analyseLyrics(human)
  pass('generated-style lyrics read as generated', g.leaning === 'reads_generated',
    `index ${(g.index*100).toFixed(1)}`)
  pass('written lyrics read as written', h.leaning === 'reads_human_written',
    `index ${(h.index*100).toFixed(1)}`)
  pass('the two are well separated', h.index - g.index > 0.3,
    `${(g.index*100).toFixed(1)} vs ${(h.index*100).toFixed(1)}`)

  // A rhyme detector that only handles single-vowel words silently scores a
  // tightly-rhymed lyric as loose, which pushes generated text toward human.
  const rhyme = g.features.find((f) => f.id === 'rhyme')!
  pass('a rhyming lyric is detected as rhyming', rhyme.value >= 0.4,
    `${(rhyme.value*100).toFixed(0)}% of pairs`)
  const freeVerse = h.features.find((f) => f.id === 'rhyme')!
  pass('free verse is not scored as rhyming', freeVerse.value <= 0.2,
    `${(freeVerse.value*100).toFixed(0)}% of pairs`)

  pass('specificity notices names and numbers',
    (g.features.find((f) => f.id === 'specificity')!.value) <
    (h.features.find((f) => f.id === 'specificity')!.value))
  pass('stock phrasing is counted where it occurs',
    (g.features.find((f) => f.id === 'collocation')!.value) >
    (h.features.find((f) => f.id === 'collocation')!.value))

  // Refusing to judge too little text matters more than judging it: a
  // four-word transcript would otherwise get a confident verdict.
  const short = analyseLyrics('Hold me close\nnever let go')
  pass('too little text is refused rather than judged',
    short.tooShort && short.leaning === 'inconclusive')

  // Section markers are structure, not writing.
  const marked = analyseLyrics(`[Verse 1]\n${human}\n[Chorus]\n${human}`)
  pass('section markers do not count as lines', marked.leaning === 'reads_human_written')
}

// ── transcript segmentation ──────────────────────────────────────────────
{
  // Whisper returns running prose; the stylometry reads line length and rhyme
  // position, so it has to be broken somewhere sensible.
  const seg = segmentLines('I kept the receipts. She said it was Tuesday, and I had no answer.')
  pass('a transcript is segmented into lines', seg.length >= 2, `${seg.length} lines`)
  pass('segmentation drops trailing punctuation', seg.every((l) => !/[,;]$/.test(l)))
  const long = segmentLines(Array.from({ length: 40 }, () => 'word').join(' '))
  pass('an unpunctuated stretch still yields lines', long.length >= 3, `${long.length} lines`)
  pass('empty input yields no lines', segmentLines('   ').length === 0)
}

// ── the error that must not happen ───────────────────────────────────────
// Calling someone's own song machine-made is expensive and irreversible;
// saying "inconclusive" costs nothing. These pin that asymmetry, using the
// plainest, most repetitive human writing there is — which is the shape of
// most hit records and exactly what a symmetric scorer condemns.
{
  const plainPop = `Baby I don't wanna go
Baby I don't wanna go
You know I love you so
Baby I don't wanna go

Every time you walk away
I got nothing left to say
Tell me that you're gonna stay
Baby I don't wanna go`

  const blues = `Woke up this morning
Trouble on my mind
Woke up this morning
Trouble on my mind
My baby done left me
And she left me far behind

Got no place to go now
Got no place to be
Got no place to go now
Got no place to be
The river keeps on running
But it don't run to me`

  const gospel = `I will lift my eyes
To the hills above
Where my help comes from
In the arms of love

Though the valley's deep
And the night is long
He will keep my soul
He will be my song`

  for (const [name, text] of [['a plain repeated chorus', plainPop], ['a spare blues', blues], ['an abstract hymn', gospel]] as [string, string][]) {
    const a = analyseLyrics(text)
    pass(`${name} is never called generated`, a.leaning !== 'reads_generated',
      `${a.leaning} at ${(a.index * 100).toFixed(1)}`)
  }

  // A refrain sung four times is one piece of writing. Counting the repeats
  // drives line variance and vocabulary reach to the floor and makes every
  // chorus-driven song look machine-regular.
  const once = analyseLyrics(plainPop)
  const thrice = analyseLyrics(`${plainPop}\n\n${plainPop}\n\n${plainPop}`)
  pass('repeating a chorus does not change the reading', once.leaning === thrice.leaning)

  // And the other direction still fires when the markers are actually there.
  const stock = `I'm walking through the endless night
Chasing dreams that burn so bright
Shattered dreams will fade away
In your arms I'll always stay
City lights are burning bright
Guiding me toward the light
Hold me close and never let go
Through the storm we'll rise and grow`
  const g = analyseLyrics(stock)
  pass('dense stock phrasing with rigid metre is still caught', g.leaning === 'reads_generated',
    `${g.leaning} at ${(g.index * 100).toFixed(1)}`)
  pass('a generated call names the markers it found', /stock phrasing|line lengths|rhyme scheme/.test(g.note))
}

// ── transcript quality gate ──────────────────────────────────────────────
// Recognition on a sung vocal can fail into fluent nonsense — real words in
// an order nobody sang. Reading the writing style of that yields a confident
// verdict about noise, which is the worst output this tool could produce.
// These use actual failure output from a recogniser run on a real vocal.
{
  const garbage = [
    "the whole fat and have read la hay and what is behind had done and head room and were leaving new to hit you nowhere and haunt me see and move on hand and you lose a lonely it will in good and me a saying even if the hood and long hey i'm home to",
    "and are fat in thailand while the is hand and and i said i need and thumb and and out while fit and i have it it is supposed to do and that is supposed to adhere to it and the the change of that and the like this on thirtieth",
  ]
  const real = [
    "baby i don't wanna go baby i don't wanna go you know i love you so baby i don't wanna go every time you walk away i got nothing left to say tell me that you're gonna stay baby i don't wanna go and i don't wanna go",
    "she kept the metro card from twenty eleven in the drawer with the batteries that don't work i said that's junk she said it's tuesday and i didn't have an answer for that now the drawer's mine and the card's still in it and the batteries still don't work and i keep meaning to throw all of it out and the batteries still don't work",
  ]
  for (const [i, text] of garbage.entries()) {
    const q = assessTranscript(segmentLines(text), 45)
    pass(`recogniser noise #${i + 1} is refused`, !q.usable, `repetition ${q.repetition.toFixed(3)}`)
  }
  for (const [i, text] of real.entries()) {
    const q = assessTranscript(segmentLines(text), 45)
    pass(`a real lyric #${i + 1} passes the gate`, q.usable, `repetition ${q.repetition.toFixed(3)}`)
  }
  const empty = assessTranscript([], 45)
  pass('an empty transcript is refused', !empty.usable)
  const firehose = assessTranscript(
    segmentLines(Array.from({ length: 400 }, () => 'word here now').join(' ')),
    30,
  )
  pass('an implausible word rate is refused', !firehose.usable,
    `${firehose.wordsPerSecond.toFixed(1)} words/sec`)
  const warned = assessTranscript(segmentLines(garbage[0]!), 45)
  pass('the refusal says what to do about it', /correct it before scanning/i.test(warned.warning ?? ''))
}

// ── the provenance classifier ────────────────────────────────────────────
// Three measurements fitted to eight tracks of known provenance. These pin
// the mechanics, not the accuracy — accuracy was established by holding each
// track out, which cannot be re-run from synthetic signal.
{
  const n = SR * 40
  const make = (pink: boolean) => {
    const out: Float64Array[] = [new Float64Array(n), new Float64Array(n)]
    const states = new Float64Array(12)
    for (let c = 0; c < 2; c += 1) {
      states.fill(0)
      for (let i = 0; i < n; i += 1) {
        const white = Math.random() * 2 - 1
        if (!pink) {
          out[c]![i] = white * 0.05
          continue
        }
        let sum = 0
        for (let k = 0; k < 12; k += 1) {
          if (i % (1 << k) === 0) states[k] = Math.random() * 2 - 1
          sum += states[k]!
        }
        out[c]![i] = (sum / 12) * 0.05
      }
    }
    return out
  }

  const white = make(false)
  const pink = make(true)

  pass('spectral flux variability is measurable', spectralFluxSd(white, SR) !== null)
  const a = scoreProvenance(white, SR)
  const b = scoreProvenance(pink, SR)
  pass('the classifier scores a signal it can measure', a.scored && b.scored)
  pass('a score is a probability', a.pGenerated >= 0 && a.pGenerated <= 1)
  // The floor slope carries the largest weight, so a flatter floor must move
  // the score toward generated. If this inverts, the model has been wired up
  // backwards and every verdict is upside down.
  pass('a flatter noise floor scores more generated than a steeper one',
    a.pGenerated > b.pGenerated,
    `white ${a.pGenerated.toFixed(3)} vs pink ${b.pGenerated.toFixed(3)}`)

  const silent = scoreProvenance([new Float64Array(SR * 8), new Float64Array(SR * 8)], SR)
  pass('silence yields no provenance score', !silent.scored)

  const track = scoreTrackProvenance(white, SR)
  pass('a whole track gets a reading', track.excerpts.length >= 1)
  pass('a track reading is one of three states',
    ['recorded', 'generated', 'inconclusive'].includes(track.resembles))
  // A probability near even odds must stay undecided rather than being
  // rounded into a verdict.
  const undecided = scoreTrackProvenance(
    [new Float64Array(SR * 8), new Float64Array(SR * 8)], SR)
  pass('an unmeasurable track is inconclusive', undecided.resembles === 'inconclusive')
}

console.log(
  failures === 0
    ? `\nAll ${checks} examiner invariants hold.\n`
    : `\n${failures} of ${checks} invariants FAILED.\n`,
)
if (failures > 0) process.exitCode = 1
