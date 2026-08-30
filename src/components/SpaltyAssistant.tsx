import { useEffect, useRef, useState, type FormEvent, type MutableRefObject } from 'react'
import { AudioWaveform, Loader2, Send, Volume2, VolumeX, X } from 'lucide-react'

type Role = 'user' | 'assistant'
type Message = { id: string; role: Role; content: string }

const GREETING: Message = {
  id: 'greeting',
  role: 'assistant',
  content: "I'm Spalty. Ask me about mastering, spatial audio, stems, or Polygon settlement.",
}

async function speak(text: string, audioRef: MutableRefObject<HTMLAudioElement | null>) {
  try {
    const res = await fetch('/api/spalty/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    audioRef.current?.pause()
    const audio = new Audio(url)
    audioRef.current = audio
    await audio.play().catch(() => {})
  } catch {
    // Voice is best-effort — the reply is already visible as text.
  }
}

export function SpaltyAssistant() {
  const [open, setOpen] = useState(false)
  const [muted, setMuted] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([GREETING])
  const [pending, setPending] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  useEffect(() => () => audioRef.current?.pause(), [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || pending) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setPending(true)

    try {
      const res = await fetch('/api/spalty/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = (await res.json()) as { reply: string; available: boolean }
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: data.reply }])
      if (!muted && data.available) void speak(data.reply, audioRef)
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "Spalty couldn't respond just now — try again in a moment.",
        },
      ])
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[90] sm:bottom-6 sm:right-6">
      {open && (
        <div
          role="dialog"
          aria-label="Spalty voice guide"
          className="mb-3 flex h-[480px] w-[min(92vw,360px)] flex-col overflow-hidden rounded-2xl border border-cyan-500/25 bg-[#0a0f1d] shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full border border-cyan-400/40 text-cyan-300">
                <AudioWaveform size={16} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-white leading-none">Spalty</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">
                  Voice guide
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Unmute Spalty's voice" : "Mute Spalty's voice"}
                aria-pressed={muted}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:text-cyan-300"
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Spalty"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:text-cyan-300"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs font-bold leading-relaxed ${
                  m.role === 'user'
                    ? 'ml-auto bg-cyan-500/15 text-white'
                    : 'border border-slate-800 bg-slate-900 text-slate-200'
                }`}
              >
                {m.content}
              </div>
            ))}
            {pending && (
              <div className="flex w-fit items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-400">
                <Loader2 size={14} className="animate-spin" /> Spalty is thinking…
              </div>
            )}
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-slate-800 p-3">
            <label className="sr-only" htmlFor="spalty-input">
              Message Spalty
            </label>
            <input
              id="spalty-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Spalty…"
              autoComplete="off"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-white placeholder-slate-500 outline-none transition-colors focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || pending}
              aria-label="Send"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-500 text-slate-950 transition-transform active:scale-95 disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close Spalty' : 'Open Spalty, the voice guide'}
        aria-expanded={open}
        className="ml-auto grid h-14 w-14 place-items-center rounded-full border border-cyan-400/50 bg-[#0a0f1d] text-cyan-300 shadow-[0_0_40px_-14px_rgba(0,240,255,0.6)] transition-transform hover:-translate-y-0.5 hover:bg-cyan-500 hover:text-slate-950"
      >
        {open ? <X size={20} /> : <AudioWaveform size={20} />}
      </button>
    </div>
  )
}
