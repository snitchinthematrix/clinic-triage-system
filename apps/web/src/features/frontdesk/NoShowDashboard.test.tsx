import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NoShowDashboard } from './NoShowDashboard'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('NoShowDashboard', () => {
  it('flags appointments above the risk threshold, using * (not a bare "count") for the count query, and persists the score', async () => {
    const countSelectSpy = vi.fn().mockReturnValue({
      eq: () => ({ eq: () => Promise.resolve({ count: 4, error: null }) }),
    })
    const upsertSpy = vi.fn().mockResolvedValue({ error: null })
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === 'appointments') {
        return {
          select: (cols: string, opts?: any) => {
            if (opts?.count) {
              // past no-show count query, called once per row
              return countSelectSpy(cols, opts)
            }
            return {
              gte: () => ({
                lte: () => Promise.resolve({
                  data: [{
                    id: 'a1', scheduled_at: '2026-10-28T09:00:00Z', created_at: '2026-10-28T09:00:00Z',
                    source: 'self_booked', patient_id: 'pat-1', patients: { profiles: { full_name: 'Alice' } },
                  }],
                  error: null,
                }),
              }),
            }
          },
        }
      }
      if (table === 'no_show_scores') {
        return { upsert: upsertSpy }
      }
      throw new Error(`unexpected table ${table}`)
    })
    render(<NoShowDashboard date="2026-09-28" />)
    await waitFor(() => expect(screen.getByText(/alice/i)).toBeInTheDocument())
    expect(screen.getByText(/high risk/i)).toBeInTheDocument()
    // PostgREST treats a bare column named "count" literally, not as an
    // aggregate — the count query must select '*' with the count option
    // instead (see NoShowDashboard.tsx fetchPastNoShowCount).
    expect(countSelectSpy).toHaveBeenCalledWith('*', { count: 'exact', head: true })
    // The computed risk is persisted, not just shown transiently in the UI.
    await waitFor(() => {
      expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({
        appointment_id: 'a1', risk_score: expect.any(Number),
      }))
    })
  })
})
