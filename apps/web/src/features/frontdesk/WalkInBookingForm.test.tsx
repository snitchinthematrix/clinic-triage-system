import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WalkInBookingForm } from './WalkInBookingForm'
import { supabase } from '../../lib/supabaseClient'
import * as appointmentsApi from '../patient/appointmentsApi'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('WalkInBookingForm', () => {
  it('lets front-desk pick a doctor, search for a patient, and book a walk-in appointment', async () => {
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === 'doctors') {
        return { select: () => Promise.resolve({
          data: [{ profile_id: 'doc-1', profiles: { full_name: 'Dr. Lee' } }], error: null,
        }) }
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              ilike: () => Promise.resolve({
                data: [{ id: 'pat-1', full_name: 'Alice Smith' }], error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    })
    const bookSpy = vi.spyOn(appointmentsApi, 'bookAppointment').mockResolvedValue({ ok: true, appointmentId: 'appt-1' })

    render(<WalkInBookingForm />)

    await waitFor(() => expect(screen.getByText('Dr. Lee')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText(/doctor/i), { target: { value: 'doc-1' } })

    fireEvent.change(screen.getByLabelText(/search patient/i), { target: { value: 'Alice' } })
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Alice Smith'))

    fireEvent.change(screen.getByLabelText(/^time$/i), { target: { value: '2026-10-05T10:00' } })
    fireEvent.click(screen.getByText(/^book$/i))

    await waitFor(() => {
      expect(bookSpy).toHaveBeenCalledWith(expect.objectContaining({
        doctorId: 'doc-1', patientId: 'pat-1', source: 'front_desk',
      }))
    })
    await waitFor(() => expect(screen.getByText(/appointment booked/i)).toBeInTheDocument())
  })

  it('shows a clear message when the walk-in slot is already taken', async () => {
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === 'doctors') {
        return { select: () => Promise.resolve({ data: [{ profile_id: 'doc-1', profiles: { full_name: 'Dr. Lee' } }], error: null }) }
      }
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ ilike: () => Promise.resolve({ data: [{ id: 'pat-1', full_name: 'Alice Smith' }], error: null }) }) }) }
      }
      throw new Error(`unexpected table ${table}`)
    })
    vi.spyOn(appointmentsApi, 'bookAppointment').mockResolvedValue({ ok: false, error: 'slot_taken' })

    render(<WalkInBookingForm />)
    await waitFor(() => expect(screen.getByText('Dr. Lee')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText(/doctor/i), { target: { value: 'doc-1' } })
    fireEvent.change(screen.getByLabelText(/search patient/i), { target: { value: 'Alice' } })
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Alice Smith'))
    fireEvent.change(screen.getByLabelText(/^time$/i), { target: { value: '2026-10-05T10:00' } })
    fireEvent.click(screen.getByText(/^book$/i))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no longer available/i)
    })
  })
})
