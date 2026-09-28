import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PatientRecordForm } from './PatientRecordForm'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('PatientRecordForm', () => {
  it('updates patient contact info', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    ;(supabase.from as any).mockReturnValue({ update: () => ({ eq: eqMock }) })
    render(<PatientRecordForm patientId="pat-1" initialInsuranceInfo="" />)
    fireEvent.change(screen.getByLabelText(/insurance info/i), { target: { value: 'Acme Health' } })
    fireEvent.click(screen.getByText(/save/i))
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument())
    expect(eqMock).toHaveBeenCalledWith('profile_id', 'pat-1')
  })
})
