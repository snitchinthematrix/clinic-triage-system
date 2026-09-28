import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submitTriage } from './aiBackendClient'
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
