import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Spalty — the SSP Engine's interactive voice guide. Text reasoning runs on
 * Claude here; the reply is read aloud client-side via /api/spalty/speak
 * (ElevenLabs), using the cloned voice model. Never allowed to break the
 * console: with no ANTHROPIC_API_KEY, or a failed/unparseable call, this
 * returns a fixed "offline" reply instead of an error.
 */

const SPALTY_SYSTEM_PROMPT =
  "You are Spalty, the voice guide of SSP Engine (sspengine.com) — a browser-based music " +
  "production and rights-settlement suite: mastering chains, spatial 3D audio, stem isolation, " +
  "cryptographic writer-code embedding, automated Polygon tax settlement, and an AI-crawler " +
  "defense perimeter. Speak as a confident, warm, knowledgeable studio co-producer — sharp and " +
  "technical, never hypey. Your replies are read aloud, so keep them short and conversational: " +
  "1-3 sentences, no markdown, no lists, no headings."

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(200).json({
      reply: "Spalty is offline right now — the site isn't configured with an Anthropic API key yet.",
      available: false,
    })
    return
  }

  const body = (req.body ?? {}) as { messages?: ChatMessage[] }
  const messages = Array.isArray(body.messages) ? body.messages : []
  if (messages.length === 0) {
    res.status(400).json({ error: 'messages is required' })
    return
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 300,
        system: SPALTY_SYSTEM_PROMPT,
        messages: messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
      }),
    })

    if (!upstream.ok) {
      res.status(200).json({
        reply: "Spalty couldn't respond just now — try again in a moment.",
        available: false,
      })
      return
    }

    const data = (await upstream.json()) as {
      content?: Array<{ type: string; text?: string }>
    }
    const textBlock = data.content?.find((block) => block.type === 'text')
    const reply = textBlock?.text?.trim() || "I didn't quite catch that — could you rephrase?"
    res.status(200).json({ reply, available: true })
  } catch {
    res.status(200).json({
      reply: "Spalty couldn't respond just now — try again in a moment.",
      available: false,
    })
  }
}
