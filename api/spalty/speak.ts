import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Reads a Spalty chat reply aloud using the cloned ElevenLabs voice model.
 * POST { text } -> audio/mpeg. Returns 503 (not an error toast — the
 * client treats this as "stay text-only") whenever the voice isn't
 * configured, so chat keeps working with no ELEVENLABS_API_KEY/VOICE_ID.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  const voiceId = process.env.ELEVENLABS_VOICE_ID
  if (!apiKey || !voiceId) {
    res.status(503).json({ error: 'Spalty voice is not configured' })
    return
  }

  const body = (req.body ?? {}) as { text?: string }
  const text = (body.text ?? '').trim().slice(0, 2000)
  if (!text) {
    res.status(400).json({ error: 'Missing text' })
    return
  }

  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      res.status(502).json({ error: 'ElevenLabs request failed', detail: detail.slice(0, 300) })
      return
    }

    const audio = Buffer.from(await upstream.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Length', String(audio.byteLength))
    res.status(200).send(audio)
  } catch {
    res.status(502).json({ error: 'ElevenLabs request failed' })
  }
}
