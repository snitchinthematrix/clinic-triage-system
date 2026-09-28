import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { VisitHistory } from './VisitHistory'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn() },
}))

describe('VisitHistory', () => {
  it('renders past visits with their patient-facing AI summary via the get_my_visit_summaries RPC', async () => {
    ;(supabase.rpc as any).mockResolvedValue({
      data: [{ appointment_id: 'a1', scheduled_at: '2026-09-01T09:00:00Z', ai_patient_summary: 'You had a mild cold.' }],
      error: null,
    })
    render(<VisitHistory patientId="pat-1" />)
    await waitFor(() => expect(screen.getByText(/mild cold/i)).toBeInTheDocument())
    // The RPC derives the patient from auth.uid() server-side (security
    // definer) rather than a client-supplied id — it never queries
    // visit_notes directly, so the doctor's raw clinical notes are never
    // fetchable by a patient, even via a hand-crafted API call.
    expect(supabase.rpc).toHaveBeenCalledWith('get_my_visit_summaries')
  })
})
