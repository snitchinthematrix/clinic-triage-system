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
})
