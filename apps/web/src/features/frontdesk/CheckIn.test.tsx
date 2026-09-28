import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CheckIn } from './CheckIn'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('CheckIn', () => {
  it('marks an appointment as checked in', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    ;(supabase.from as any).mockReturnValue({ update: () => ({ eq: eqMock }) })
    render(<CheckIn appointmentId="a1" patientName="Alice" />)
    fireEvent.click(screen.getByText(/check in/i))
    await waitFor(() => expect(screen.getByText(/checked in/i)).toBeInTheDocument())
    expect(eqMock).toHaveBeenCalledWith('id', 'a1')
  })
})
