import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NoShowDashboard } from './NoShowDashboard'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('NoShowDashboard', () => {
  it('flags appointments above the risk threshold', async () => {
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === 'appointments') {
        return {
          select: (cols: string) => {
            if (cols.includes('count')) {
              // past no-show count query, called once per row
              return { eq: () => ({ eq: () => Promise.resolve({ count: 4, error: null }) }) }
            }
            return {
              gte: () => ({
                lte: () => Promise.resolve({
                  data: [{
                    id: 'a1', scheduled_at: '2026-10-28T09:00:00Z', source: 'self_booked',
                    patient_id: 'pat-1', patients: { profiles: { full_name: 'Alice' } },
                  }],
                  error: null,
                }),
              }),
            }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    })
    render(<NoShowDashboard date="2026-09-28" />)
    await waitFor(() => expect(screen.getByText(/alice/i)).toBeInTheDocument())
    expect(screen.getByText(/high risk/i)).toBeInTheDocument()
  })
})
