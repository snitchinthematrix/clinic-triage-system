import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PatientBookingPage } from './PatientBookingPage'
import * as triageClient from './aiBackendClient'
import * as appointmentsApi from './appointmentsApi'

describe('PatientBookingPage', () => {
  it('passes the triage result into bookAppointment once both steps complete', async () => {
    vi.spyOn(triageClient, 'submitTriage').mockResolvedValue({
      urgency: 'soon', suggestedDepartment: 'General Practice', disclaimer: 'not a diagnosis',
      symptomText: 'mild fever',
    })
    const bookSpy = vi.spyOn(appointmentsApi, 'bookAppointment').mockResolvedValue({ ok: true, appointmentId: 'appt-1' })

    render(<PatientBookingPage doctorId="doc-1" patientId="pat-1" scheduledAt="2026-10-01T09:00:00Z" />)

    fireEvent.change(screen.getByLabelText(/describe your symptoms/i), { target: { value: 'mild fever' } })
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: '3' } })
    fireEvent.click(screen.getByText(/submit/i))

    await waitFor(() => screen.getByText(/confirm booking/i))
    fireEvent.click(screen.getByText(/confirm booking/i))

    await waitFor(() => {
      expect(bookSpy).toHaveBeenCalledWith(expect.objectContaining({
        doctorId: 'doc-1', patientId: 'pat-1', scheduledAt: '2026-10-01T09:00:00Z',
        triageResult: expect.objectContaining({ urgency: 'soon', symptomText: 'mild fever' }),
      }))
    })
  })
})
