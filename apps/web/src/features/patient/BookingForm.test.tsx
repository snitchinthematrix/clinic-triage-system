import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BookingForm } from './BookingForm'
import * as api from './appointmentsApi'
import * as aiBackendClient from './aiBackendClient'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: { getUser: vi.fn() } },
}))

describe('BookingForm', () => {
  it('shows a clear message when the slot was just taken by someone else', async () => {
    vi.spyOn(api, 'bookAppointment').mockResolvedValue({ ok: false, error: 'slot_taken' })
    render(<BookingForm doctorId="doc-1" patientId="pat-1" scheduledAt="2026-10-01T09:00:00Z" />)
    fireEvent.click(screen.getByText(/confirm booking/i))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no longer available/i)
    })
  })

  it('confirms booking on success', async () => {
    vi.spyOn(api, 'bookAppointment').mockResolvedValue({ ok: true, appointmentId: 'appt-1' })
    render(<BookingForm doctorId="doc-1" patientId="pat-1" scheduledAt="2026-10-01T09:00:00Z" />)
    fireEvent.click(screen.getByText(/confirm booking/i))
    await waitFor(() => {
      expect(screen.getByText(/appointment booked/i)).toBeInTheDocument()
    })
  })

  it('sends a booking confirmation email on success', async () => {
    vi.spyOn(api, 'bookAppointment').mockResolvedValue({ ok: true, appointmentId: 'appt-1' })
    const confirmSpy = vi.spyOn(aiBackendClient, 'sendBookingConfirmation').mockResolvedValue()
    ;(supabase.from as any).mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { profiles: { full_name: 'Dr. Lee' } } }) }) }),
    })
    ;(supabase.auth.getUser as any).mockResolvedValue({ data: { user: { email: 'alice@example.com' } } })

    render(<BookingForm doctorId="doc-1" patientId="pat-1" scheduledAt="2026-10-01T09:00:00Z" />)
    fireEvent.click(screen.getByText(/confirm booking/i))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith({
        to: 'alice@example.com', scheduledAt: '2026-10-01T09:00:00Z', doctorName: 'Dr. Lee',
      })
    })
  })

  it('still shows "booked" even if the confirmation email fails to send', async () => {
    vi.spyOn(api, 'bookAppointment').mockResolvedValue({ ok: true, appointmentId: 'appt-1' })
    vi.spyOn(aiBackendClient, 'sendBookingConfirmation').mockRejectedValue(new Error('email failed'))
    ;(supabase.from as any).mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { profiles: { full_name: 'Dr. Lee' } } }) }) }),
    })
    ;(supabase.auth.getUser as any).mockResolvedValue({ data: { user: { email: 'alice@example.com' } } })

    render(<BookingForm doctorId="doc-1" patientId="pat-1" scheduledAt="2026-10-01T09:00:00Z" />)
    fireEvent.click(screen.getByText(/confirm booking/i))

    await waitFor(() => {
      expect(screen.getByText(/appointment booked/i)).toBeInTheDocument()
    })
  })
})
