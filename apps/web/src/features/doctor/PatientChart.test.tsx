import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PatientChart } from './PatientChart'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('PatientChart', () => {
  it('shows the patient name and most recent triage note', async () => {
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === 'patients') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { profiles: { full_name: 'Alice' } }, error: null }) }) }) }
      }
      return {
        select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [{ symptom_text: 'headache' }], error: null }) }) }) }),
      }
    })
    render(<PatientChart patientId="pat-1" />)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText(/headache/)).toBeInTheDocument()
    })
  })
})
