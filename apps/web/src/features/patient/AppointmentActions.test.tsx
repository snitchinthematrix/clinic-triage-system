import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AppointmentActions } from './AppointmentActions'
import * as api from './appointmentsApi'

describe('AppointmentActions', () => {
  it('cancels an appointment', async () => {
    vi.spyOn(api, 'cancelAppointment').mockResolvedValue({ ok: true })
    render(<AppointmentActions appointment={{ id: 'appt-1', scheduledAt: '2026-10-01T09:00:00Z' }} />)
    fireEvent.click(screen.getByText(/cancel/i))
    await waitFor(() => expect(screen.getByText(/cancelled/i)).toBeInTheDocument())
  })

  it('reschedules an appointment to a new time', async () => {
    const rescheduleSpy = vi.spyOn(api, 'rescheduleAppointment').mockResolvedValue({ ok: true, appointmentId: 'appt-1' })
    render(<AppointmentActions appointment={{ id: 'appt-1', scheduledAt: '2026-10-01T09:00:00Z' }} />)
    fireEvent.change(screen.getByLabelText(/new time/i), { target: { value: '2026-10-05T10:00' } })
    fireEvent.click(screen.getByText(/reschedule/i))
    await waitFor(() => {
      expect(rescheduleSpy).toHaveBeenCalledWith('appt-1', expect.stringContaining('2026-10-05'))
    })
  })

  it('shows a clear message when the new slot is already taken', async () => {
    vi.spyOn(api, 'rescheduleAppointment').mockResolvedValue({ ok: false, error: 'slot_taken' })
    render(<AppointmentActions appointment={{ id: 'appt-1', scheduledAt: '2026-10-01T09:00:00Z' }} />)
    fireEvent.change(screen.getByLabelText(/new time/i), { target: { value: '2026-10-05T10:00' } })
    fireEvent.click(screen.getByText(/reschedule/i))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no longer available/i)
    })
  })
})
