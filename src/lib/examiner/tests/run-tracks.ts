/** Run the examiner over real files, outside the browser, for calibration. */
import { readFileSync, readdirSync } from 'node:fs'
import { examine } from '../examine'
import type { AudioBuffer32 } from '../audio-types'

function readWav(path: string): AudioBuffer32 {
  const buf = readFileSync(path)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let pos = 12
  let fmt: { channels: number; sampleRate: number; bits: number } | null = null
  let dataOffset = -1
  let dataLength = 0
  while (pos + 8 <= buf.byteLength) {
    const id = String.fromCharCode(buf[pos]!, buf[pos + 1]!, buf[pos + 2]!, buf[pos + 3]!)
    const size = view.getUint32(pos + 4, true)
    if (id === 'fmt ') {
      fmt = {
        channels: view.getUint16(pos + 10, true),
        sampleRate: view.getUint32(pos + 12, true),
        bits: view.getUint16(pos + 22, true),
      }
    } else if (id === 'data') {
      dataOffset = pos + 8
      dataLength = size
    }
    pos += 8 + size + (size % 2)
  }
  if (!fmt || dataOffset < 0) throw new Error(`not a readable wav: ${path}`)
  const frames = dataLength / (fmt.channels * (fmt.bits / 8))
  const samples = new Float32Array(frames * fmt.channels)
  for (let i = 0; i < frames * fmt.channels; i += 1) {
    samples[i] = view.getInt16(dataOffset + i * 2, true) / 32768
  }
  return {
    sampleRate: fmt.sampleRate,
    channels: fmt.channels,
    samples,
    length: frames,
    bitDepth: 32,
    format: 'float32',
  }
}

const dir = process.argv[2]!
const limitSec = Number(process.argv[3] ?? '0')

for (const name of readdirSync(dir).filter((f) => f.endsWith('.wav')).sort()) {
  const audio = readWav(`${dir}/${name}`)
  let clipped = audio
  if (limitSec > 0 && audio.length / audio.sampleRate > limitSec) {
    // Take from a third of the way in: intros are often sparse and
    // unrepresentative of how the record was actually made.
    const want = Math.round(limitSec * audio.sampleRate)
    const start = Math.round(audio.length / 3)
    const end = Math.min(audio.length, start + want)
    clipped = {
      ...audio,
      samples: audio.samples.slice(start * audio.channels, end * audio.channels),
      length: end - start,
    }
  }
  const t0 = Date.now()
  const f = examine(clipped, { fileName: name, sha256: 'n/a' })
  const secs = (Date.now() - t0) / 1000
  console.log(`\n=== ${name}  (${(clipped.length / clipped.sampleRate).toFixed(0)}s analysed in ${secs.toFixed(1)}s) ===`)
  console.log(`  VERDICT   ${f.verdict}   index ${(f.authorshipIndex * 100).toFixed(1)}   ${f.eligibility}`)
  for (const s of f.stems) {
    console.log(
      `    ${s.stem.padEnd(17)} ${s.copyright_status.padEnd(14)} score ${(s.human_score * 100).toFixed(0).padStart(3)}  energy ${(s.energy_share * 100).toFixed(1).padStart(5)}%  conf ${(s.confidence * 100).toFixed(0)}%`,
    )
    for (const feat of s.features) {
      console.log(`        w${feat.weight.toFixed(2)}  ${feat.interpretation}`)
    }
  }
}
