import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DoctorHome } from './DoctorHome'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('DoctorHome', () => {
  it("renders the doctor's daily queue and availability editor", () => {
    ;(supabase.from as any).mockReturnValue({
      select: () => ({
        eq: () => ({
          gte: () => ({ lte: () => ({ in: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }),
        }),
      }),
      update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    })
    render(<DoctorHome doctorId="doc-1" />)
    expect(screen.getByRole('heading', { name: /today's queue/i })).toBeInTheDocument()
    expect(screen.getByText(/save availability/i)).toBeInTheDocument()
  })
})
