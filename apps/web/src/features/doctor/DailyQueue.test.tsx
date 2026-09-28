import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DailyQueue } from './DailyQueue'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('DailyQueue', () => {
  it('lists urgent patients before routine ones', async () => {
    ;(supabase.from as any).mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({
            data: [
              { id: 'a1', scheduled_at: '2026-09-28T09:00:00Z', urgency_level: 'routine', patients: { profiles: { full_name: 'Alice' } } },
              { id: 'a2', scheduled_at: '2026-09-28T09:30:00Z', urgency_level: 'urgent', patients: { profiles: { full_name: 'Bob' } } },
            ],
            error: null,
          }),
        }),
      }),
    })
    render(<DailyQueue doctorId="doc-1" date="2026-09-28" />)
    await waitFor(() => {
      const names = screen.getAllByTestId('patient-name').map((n) => n.textContent)
      expect(names).toEqual(['Bob', 'Alice'])
    })
  })
})
