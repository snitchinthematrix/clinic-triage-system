import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MasterCalendar } from './MasterCalendar'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('MasterCalendar', () => {
  it('lists appointments across multiple doctors for the day', async () => {
    ;(supabase.from as any).mockReturnValue({
      select: () => ({
        gte: () => ({
          lte: () => Promise.resolve({
            data: [
              { id: 'a1', scheduled_at: '2026-09-28T09:00:00Z', doctors: { profiles: { full_name: 'Dr. Lee' } }, patients: { profiles: { full_name: 'Alice' } } },
              { id: 'a2', scheduled_at: '2026-09-28T10:00:00Z', doctors: { profiles: { full_name: 'Dr. Patel' } }, patients: { profiles: { full_name: 'Bob' } } },
            ],
            error: null,
          }),
        }),
      }),
    })
    render(<MasterCalendar date="2026-09-28" />)
    await waitFor(() => {
      expect(screen.getByText('Dr. Lee')).toBeInTheDocument()
      expect(screen.getByText('Dr. Patel')).toBeInTheDocument()
    })
  })
})
