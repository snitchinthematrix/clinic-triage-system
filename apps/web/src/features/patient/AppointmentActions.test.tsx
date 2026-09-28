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
})
