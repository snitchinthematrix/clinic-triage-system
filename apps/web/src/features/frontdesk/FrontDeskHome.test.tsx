import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FrontDeskHome } from './FrontDeskHome'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('FrontDeskHome', () => {
  it('renders the master calendar and no-show dashboard', () => {
    ;(supabase.from as any).mockReturnValue({
      select: () => ({
        gte: () => ({ lte: () => Promise.resolve({ data: [], error: null }) }),
        eq: () => ({ eq: () => Promise.resolve({ count: 0, error: null }) }),
      }),
    })
    render(<FrontDeskHome />)
    expect(screen.getByRole('heading', { name: /today's calendar/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /no-show risk/i })).toBeInTheDocument()
  })
})
