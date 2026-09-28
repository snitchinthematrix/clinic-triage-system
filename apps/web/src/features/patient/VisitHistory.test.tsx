import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { VisitHistory } from './VisitHistory'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

describe('VisitHistory', () => {
  it('renders past visits with their patient-facing AI summary', async () => {
    ;(supabase.from as any).mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({
            data: [{ appointment_id: 'a1', scheduled_at: '2026-09-01T09:00:00Z', ai_patient_summary: 'You had a mild cold.' }],
            error: null,
          }),
        }),
      }),
    })
    render(<VisitHistory patientId="pat-1" />)
    await waitFor(() => expect(screen.getByText(/mild cold/i)).toBeInTheDocument())
  })
})
