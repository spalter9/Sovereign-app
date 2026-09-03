/**
 * The decoded-audio shape the examiner measures.
 *
 * In the console this comes from the browser's own AudioContext decode — the
 * file never leaves the machine, which is the promise the transport section
 * already makes to anyone who drops a track on it.
 */
export type AudioBuffer32 = {
  sampleRate: number;
  channels: number;
  /** Interleaved Float32 PCM. */
  samples: Float32Array;
  length: number;
  bitDepth: 32;
  format: "float32";
};
