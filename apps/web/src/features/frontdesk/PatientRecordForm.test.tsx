import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PatientRecordForm } from './PatientRecordForm'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('PatientRecordForm', () => {
  it('updates patient contact info (insurance)', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    ;(supabase.from as any).mockReturnValue({ update: () => ({ eq: eqMock }) })
    render(<PatientRecordForm patientId="pat-1" initialInsuranceInfo="" initialFullName="Alice" initialPhone="" />)
    fireEvent.change(screen.getByLabelText(/insurance info/i), { target: { value: 'Acme Health' } })
    fireEvent.click(screen.getByText(/save/i))
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument())
    expect(eqMock).toHaveBeenCalledWith('profile_id', 'pat-1')
  })

  it('updates the patient name and phone on profiles, alongside insurance info on patients', async () => {
    const patientsUpdateSpy = vi.fn()
    const profilesUpdateSpy = vi.fn()
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === 'patients') {
        return { update: (v: any) => { patientsUpdateSpy(v); return { eq: vi.fn().mockResolvedValue({ error: null }) } } }
      }
      if (table === 'profiles') {
        return { update: (v: any) => { profilesUpdateSpy(v); return { eq: vi.fn().mockResolvedValue({ error: null }) } } }
      }
      throw new Error(`unexpected table ${table}`)
    })
    render(<PatientRecordForm patientId="pat-1" initialInsuranceInfo="" initialFullName="Alice" initialPhone="555-0100" />)
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Alice Smith' } })
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '555-0199' } })
    fireEvent.click(screen.getByText(/save/i))
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument())
    expect(profilesUpdateSpy).toHaveBeenCalledWith({ full_name: 'Alice Smith', phone: '555-0199' })
    expect(patientsUpdateSpy).toHaveBeenCalledWith({ insurance_info: '' })
  })
})
