import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submitTriage, sendBookingConfirmation } from './aiBackendClient'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

describe('submitTriage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { access_token: 'session-token-123' } },
    })
  })

  it('sends the current Supabase session token as a bearer token', async () => {
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ urgency: 'routine', suggestedDepartment: 'General Practice', disclaimer: 'not a diagnosis' }),
    })

    await submitTriage({ symptomText: 'cough', bodyArea: 'chest', durationDays: 1, severity: 2 })

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/triage'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer session-token-123' }),
      })
    )
  })
})

describe('sendBookingConfirmation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { access_token: 'session-token-123' } },
    })
  })

  it('posts to /notify/appointment-confirmation with a bearer token', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    await sendBookingConfirmation({ to: 'alice@example.com', scheduledAt: '2026-10-01T09:00:00Z', doctorName: 'Dr. Lee' })

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/notify/appointment-confirmation'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer session-token-123' }),
        body: JSON.stringify({ to: 'alice@example.com', scheduledAt: '2026-10-01T09:00:00Z', doctorName: 'Dr. Lee' }),
      })
    )
  })
})
