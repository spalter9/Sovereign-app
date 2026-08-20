import { useCallback, useEffect, useRef, useState } from 'react'

export const ACCEPTED_AUDIO =
  'audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,audio/flac,audio/x-flac,audio/aiff,audio/x-aiff,audio/mp4,audio/x-m4a,audio/aac,.mp3,.wav,.flac,.aiff,.aif,.m4a,.aac'

const ACCEPT_EXT = /\.(mp3|wav|flac|aiff|aif|m4a|aac)$/i

export function isAcceptedAudioFile(file: File): boolean {
  if (ACCEPT_EXT.test(file.name)) return true
  return file.type.startsWith('audio/')
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export interface AudioTransportState {
  fileName: string | null
  fileSizeLabel: string | null
  isPlaying: boolean
  isLooping: boolean
  currentTime: number
  duration: number
  currentLabel: string
  durationLabel: string
  progress: number
  error: string | null
  hasTrack: boolean
  analyser: AnalyserNode | null
  loadFile: (file: File) => Promise<void>
  play: () => Promise<void>
  pause: () => void
  stop: () => void
  toggleLoop: () => void
  seek: (ratio: number) => void
  clear: () => void
}

export function useAudioTransport(
  onStatus?: (status: string) => void,
): AudioTransportState {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [fileSizeLabel, setFileSizeLabel] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

  const tearDownUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  const ensureGraph = useCallback(async (audio: HTMLAudioElement) => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctxRef.current = new Ctx()
    }
    const ctx = ctxRef.current
    if (ctx.state === 'suspended') await ctx.resume()

    if (!sourceRef.current) {
      const source = ctx.createMediaElementSource(audio)
      const analyserNode = ctx.createAnalyser()
      analyserNode.fftSize = 256
      source.connect(analyserNode)
      analyserNode.connect(ctx.destination)
      sourceRef.current = source
      analyserRef.current = analyserNode
      setAnalyser(analyserNode)
    }
  }, [])

  const clear = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    tearDownUrl()
    setFileName(null)
    setFileSizeLabel(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setError(null)
    onStatus?.('TRANSPORT // CLEARED')
  }, [onStatus, tearDownUrl])

  const loadFile = useCallback(
    async (file: File) => {
      if (!isAcceptedAudioFile(file)) {
        setError('Unsupported format. Use MP3, WAV, FLAC, AIFF, or M4A.')
        onStatus?.('TRANSPORT // REJECTED FORMAT')
        return
      }

      if (!audioRef.current) {
        audioRef.current = new Audio()
        audioRef.current.preload = 'auto'
      }

      const audio = audioRef.current
      audio.pause()
      tearDownUrl()

      const objectUrl = URL.createObjectURL(file)
      urlRef.current = objectUrl
      audio.src = objectUrl
      audio.loop = isLooping

      setFileName(file.name)
      setFileSizeLabel(`${(file.size / (1024 * 1024)).toFixed(2)} MB`)
      setError(null)
      setCurrentTime(0)
      setDuration(0)
      setIsPlaying(false)
      onStatus?.(`LOADED // ${file.name.toUpperCase()}`)

      await new Promise<void>((resolve, reject) => {
        const onMeta = () => {
          cleanup()
          setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
          resolve()
        }
        const onFail = () => {
          cleanup()
          setError('Could not decode this audio file in the browser.')
          onStatus?.('TRANSPORT // DECODE FAILED')
          reject(new Error('decode failed'))
        }
        const cleanup = () => {
          audio.removeEventListener('loadedmetadata', onMeta)
          audio.removeEventListener('error', onFail)
        }
        audio.addEventListener('loadedmetadata', onMeta)
        audio.addEventListener('error', onFail)
        audio.load()
      }).catch(() => {
        /* error already set */
      })
    },
    [isLooping, onStatus, tearDownUrl],
  )

  const play = useCallback(async () => {
    const audio = audioRef.current
    if (!audio?.src) {
      setError('Drop an audio file first.')
      return
    }
    try {
      await ensureGraph(audio)
      await audio.play()
      setIsPlaying(true)
      setError(null)
      onStatus?.('STREAM // PLAYING')
    } catch {
      setError('Playback blocked. Click Play again after interacting with the page.')
      onStatus?.('TRANSPORT // PLAY BLOCKED')
    }
  }, [ensureGraph, onStatus])

  const pause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    setIsPlaying(false)
    onStatus?.('STREAM // PAUSED')
  }, [onStatus])

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    setIsPlaying(false)
    setCurrentTime(0)
    onStatus?.('STREAM // STOPPED')
  }, [onStatus])

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => {
      const next = !prev
      if (audioRef.current) audioRef.current.loop = next
      onStatus?.(next ? 'STREAM // LOOP ON' : 'STREAM // LOOP OFF')
      return next
    })
  }, [onStatus])

  const seek = useCallback((ratio: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return
    const clamped = Math.min(1, Math.max(0, ratio))
    audio.currentTime = clamped * audio.duration
    setCurrentTime(audio.currentTime)
  }, [])

  useEffect(() => {
    const audio = audioRef.current ?? new Audio()
    audioRef.current = audio

    const onTime = () => setCurrentTime(audio.currentTime)
    const onDur = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onEnded = () => {
      if (!audio.loop) {
        setIsPlaying(false)
        onStatus?.('STREAM // ENDED')
      }
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDur)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDur)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.pause()
      tearDownUrl()
      void ctxRef.current?.close()
      ctxRef.current = null
      sourceRef.current = null
      analyserRef.current = null
    }
  }, [onStatus, tearDownUrl])

  const progress = duration > 0 ? currentTime / duration : 0

  return {
    fileName,
    fileSizeLabel,
    isPlaying,
    isLooping,
    currentTime,
    duration,
    currentLabel: formatTime(currentTime),
    durationLabel: formatTime(duration),
    progress,
    error,
    hasTrack: Boolean(fileName),
    analyser,
    loadFile,
    play,
    pause,
    stop,
    toggleLoop,
    seek,
    clear,
  }
}
