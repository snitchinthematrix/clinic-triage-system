import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FrontDeskHome } from './FrontDeskHome'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('FrontDeskHome', () => {
  it('renders the master calendar, no-show dashboard, and walk-in booking form', () => {
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === 'doctors') {
        return { select: () => Promise.resolve({ data: [], error: null }) }
      }
      return {
        select: () => ({
          gte: () => ({ lte: () => Promise.resolve({ data: [], error: null }) }),
          eq: () => ({ eq: () => Promise.resolve({ count: 0, error: null }) }),
        }),
      }
    })
    render(<FrontDeskHome />)
    expect(screen.getByRole('heading', { name: /today's calendar/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /no-show risk/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /walk-in booking/i })).toBeInTheDocument()
  })
})
