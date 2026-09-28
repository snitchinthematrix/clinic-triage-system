import { describe, it, expect, vi, beforeEach } from 'vitest'
import { summarizeNotes } from './visitNotesApi'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { auth: { getSession: vi.fn() }, from: vi.fn() },
}))

describe('summarizeNotes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    ;(supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { access_token: 'session-token-123' } },
    })
  })

  it('sends the current Supabase session token as a bearer token', async () => {
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ clinicalSummary: 'x', patientSummary: 'y' }),
    })

    await summarizeNotes('some raw notes')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/summarize-visit'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer session-token-123' }),
      })
    )
  })
})
