import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendEmail } from './email'

describe('sendEmail', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))

  it('returns ok true on successful send', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true })
    const result = await sendEmail('patient@example.com', 'Subject', 'Body')
    expect(result.ok).toBe(true)
  })

  it('returns ok false when the email provider fails', async () => {
    ;(fetch as any).mockResolvedValue({ ok: false, status: 500 })
    const result = await sendEmail('patient@example.com', 'Subject', 'Body')
    expect(result.ok).toBe(false)
  })
})
