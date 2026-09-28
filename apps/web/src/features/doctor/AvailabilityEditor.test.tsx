import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AvailabilityEditor } from './AvailabilityEditor'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('AvailabilityEditor', () => {
  it('saves updated working hours', async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    ;(supabase.from as any).mockReturnValue({ update: () => ({ eq: updateEq }) })
    render(<AvailabilityEditor doctorId="doc-1" />)
    fireEvent.change(screen.getByLabelText(/monday start/i), { target: { value: '09:00' } })
    fireEvent.click(screen.getByText(/save availability/i))
    await waitFor(() => expect(updateEq).toHaveBeenCalledWith('profile_id', 'doc-1'))
  })
})
