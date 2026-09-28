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

    await waitFor(() => screen.getByText(/continue to booking/i))
    fireEvent.click(screen.getByText(/continue to booking/i))

    await waitFor(() => screen.getByText(/confirm booking/i))
    fireEvent.click(screen.getByText(/confirm booking/i))

    await waitFor(() => {
      expect(bookSpy).toHaveBeenCalledWith(expect.objectContaining({
        doctorId: 'doc-1', patientId: 'pat-1', scheduledAt: '2026-10-01T09:00:00Z',
        triageResult: expect.objectContaining({ urgency: 'soon', symptomText: 'mild fever' }),
      }))
    })
  })

  it('never reaches the booking form for an emergency result, and never books an appointment (I4)', async () => {
    vi.spyOn(triageClient, 'submitTriage').mockResolvedValue({
      urgency: 'emergency', suggestedDepartment: 'Emergency', disclaimer: 'not a diagnosis',
      symptomText: 'chest pain',
    })
    const bookSpy = vi.spyOn(appointmentsApi, 'bookAppointment')

    render(<PatientBookingPage doctorId="doc-1" patientId="pat-1" scheduledAt="2026-10-01T09:00:00Z" />)

    fireEvent.change(screen.getByLabelText(/describe your symptoms/i), { target: { value: 'chest pain' } })
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: '10' } })
    fireEvent.click(screen.getByText(/submit/i))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/call emergency services/i)
    })
    expect(screen.queryByText(/confirm booking/i)).not.toBeInTheDocument()
    expect(bookSpy).not.toHaveBeenCalled()
  })

  it('shows the fallback disclaimer for an unknown-urgency result without silently booking', async () => {
    vi.spyOn(triageClient, 'submitTriage').mockResolvedValue({
      urgency: 'unknown', suggestedDepartment: null,
      disclaimer: 'We could not automatically assess your symptoms right now. Please call the clinic directly, or call emergency services if this is urgent.',
      symptomText: 'sore throat',
    })
    const bookSpy = vi.spyOn(appointmentsApi, 'bookAppointment')

    render(<PatientBookingPage doctorId="doc-1" patientId="pat-1" scheduledAt="2026-10-01T09:00:00Z" />)

    fireEvent.change(screen.getByLabelText(/describe your symptoms/i), { target: { value: 'sore throat' } })
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: '2' } })
    fireEvent.click(screen.getByText(/submit/i))

    await waitFor(() => expect(screen.getByText(/call the clinic directly/i)).toBeInTheDocument())
    expect(bookSpy).not.toHaveBeenCalled()
  })
})
