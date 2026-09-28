import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PatientHome } from './PatientHome'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }))

describe('PatientHome', () => {
  it('renders the visit history for the signed-in patient', () => {
    ;(supabase.rpc as any).mockResolvedValue({ data: [], error: null })
    render(<PatientHome patientId="pat-1" />)
    expect(screen.getByRole('heading', { name: /your visit history/i })).toBeInTheDocument()
  })
})
