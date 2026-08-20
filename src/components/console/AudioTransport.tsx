import { useCallback, useEffect, useRef, useState, type DragEvent, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { ACCEPTED_AUDIO, useAudioTransport } from '../../hooks/useAudioTransport'

interface AudioTransportProps {
  onStatus: (status: string) => void
}

export function AudioTransport({ onStatus }: AudioTransportProps) {
  const transport = useAudioTransport(onStatus)
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dragging, setDragging] = useState(false)
  const rafRef = useRef<number | null>(null)

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      const file = files?.[0]
      if (!file) return
      await transport.loadFile(file)
    },
    [transport],
  )

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragging(false)
      void handleFiles(event.dataTransfer.files)
    },
    [handleFiles],
  )

  const onBrowse = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      void handleFiles(event.target.files)
      event.target.value = ''
    },
    [handleFiles],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#020617'
      ctx.fillRect(0, 0, width, height)

      const analyser = transport.analyser
      if (analyser && transport.isPlaying) {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const bars = 48
        const step = Math.floor(data.length / bars)
        const barW = width / bars - 2
        for (let i = 0; i < bars; i += 1) {
          const value = data[i * step] / 255
          const barH = Math.max(2, value * (height - 8))
          const x = i * (barW + 2)
          const y = (height - barH) / 2
          const hue = 180 + value * 40
          ctx.fillStyle = `hsla(${hue}, 90%, 55%, 0.9)`
          ctx.fillRect(x, y, barW, barH)
        }
      } else {
        // Idle waveform placeholder
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)'
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let x = 0; x < width; x += 1) {
          const y =
            height / 2 +
            Math.sin(x * 0.035) * 10 +
            Math.sin(x * 0.01) * 6
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()

        // Progress scrub fill
        if (transport.hasTrack && transport.progress > 0) {
          ctx.fillStyle = 'rgba(34, 211, 238, 0.12)'
          ctx.fillRect(0, 0, width * transport.progress, height)
        }
      }

      rafRef.current = window.requestAnimationFrame(draw)
    }

    rafRef.current = window.requestAnimationFrame(draw)
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current)
    }
  }, [transport.analyser, transport.hasTrack, transport.isPlaying, transport.progress])

  const onSeekClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (!transport.hasTrack) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    transport.seek(ratio)
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragging(false)
        }}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={
          dragging
            ? 'cursor-pointer rounded-xl border border-cyan-400 bg-cyan-500/10 px-4 py-8 text-center transition-colors'
            : 'cursor-pointer rounded-xl border border-dashed border-slate-700 bg-slate-950/80 px-4 py-8 text-center transition-colors hover:border-cyan-500/50'
        }
      >
        <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
          Drop an MP3, WAV, FLAC, AIFF, or M4A
        </p>
        <p className="mt-2 text-[11px] font-bold text-slate-400">
          or click to browse — local decode only, nothing uploaded to a server
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_AUDIO}
          className="hidden"
          onChange={onBrowse}
        />
      </div>

      <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        <canvas
          ref={canvasRef}
          width={960}
          height={192}
          className="h-48 w-full cursor-pointer"
          onClick={onSeekClick}
          aria-label="Waveform and seek"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/90 to-transparent px-3 py-2">
          <span className="font-mono text-[10px] text-cyan-300">
            {transport.hasTrack ? transport.fileName : 'NO MEDIA LOADED'}
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {transport.currentLabel} / {transport.durationLabel}
            {transport.fileSizeLabel ? ` · ${transport.fileSizeLabel}` : ''}
          </span>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(transport.progress * 1000)}
        disabled={!transport.hasTrack}
        onChange={(e) => transport.seek(Number(e.target.value) / 1000)}
        className="w-full accent-cyan-400 disabled:opacity-40"
        aria-label="Seek"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void transport.play()}
          disabled={!transport.hasTrack}
          className="rounded-xl bg-cyan-500 px-6 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ▶ Play
        </button>
        <button
          type="button"
          onClick={transport.pause}
          disabled={!transport.hasTrack || !transport.isPlaying}
          className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-wider text-white transition-all hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ⏸ Pause
        </button>
        <button
          type="button"
          onClick={transport.stop}
          disabled={!transport.hasTrack}
          className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-wider text-white transition-all hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ⏹ Stop
        </button>
        <button
          type="button"
          onClick={transport.toggleLoop}
          disabled={!transport.hasTrack}
          className={
            transport.isLooping
              ? 'rounded-xl border border-cyan-400 bg-cyan-500/20 px-6 py-3 text-xs font-black uppercase tracking-wider text-cyan-200 transition-all disabled:cursor-not-allowed disabled:opacity-40'
              : 'rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-wider text-white transition-all hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40'
          }
        >
          🔁 Loop {transport.isLooping ? 'On' : 'Off'}
        </button>
        <button
          type="button"
          onClick={transport.clear}
          disabled={!transport.hasTrack}
          className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-6 py-3 text-xs font-black uppercase tracking-wider text-rose-200 transition-all hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      {transport.error ? (
        <p className="text-xs font-bold text-rose-400" role="alert">
          {transport.error}
        </p>
      ) : (
        <p className="text-[11px] font-bold text-slate-500">
          {transport.hasTrack ? 'Track armed · Play / Pause / Stop / Loop / Seek ready' : 'Awaiting ingest'}
        </p>
      )}
    </div>
  )
}
