import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callGemini, GeminiUnavailableError } from './client'

describe('callGemini', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns parsed JSON on success', async () => {
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"urgency":"routine"}' }] } }],
      }),
    })
    const result = await callGemini('some prompt', {})
    expect(result).toEqual({ urgency: 'routine' })
  })

  it('throws GeminiUnavailableError on non-ok response', async () => {
    ;(fetch as any).mockResolvedValue({ ok: false, status: 503 })
    await expect(callGemini('some prompt', {})).rejects.toBeInstanceOf(GeminiUnavailableError)
  })

  it('throws GeminiUnavailableError on network failure', async () => {
    ;(fetch as any).mockRejectedValue(new Error('network down'))
    await expect(callGemini('some prompt', {})).rejects.toBeInstanceOf(GeminiUnavailableError)
  })

  it('throws GeminiUnavailableError (not a raw parse error) when the response body is not valid JSON', async () => {
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token')
      },
    })
    await expect(callGemini('some prompt', {})).rejects.toBeInstanceOf(GeminiUnavailableError)
  })

  it('calls the gemini-flash-latest model by default (gemini-1.5-flash was retired by Google)', async () => {
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }),
    })
    await callGemini('some prompt', {})
    const url = (fetch as any).mock.calls[0][0] as string
    expect(url).toContain('/models/gemini-flash-latest:generateContent')
  })

  it('uses GEMINI_MODEL to override the model without a code change, if set', async () => {
    const original = process.env.GEMINI_MODEL
    process.env.GEMINI_MODEL = 'gemini-3.8-flash'
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }),
    })
    await callGemini('some prompt', {})
    const url = (fetch as any).mock.calls[0][0] as string
    process.env.GEMINI_MODEL = original
    expect(url).toContain('/models/gemini-3.8-flash:generateContent')
  })
})
