import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { VisitNoteEditor } from './VisitNoteEditor'
import * as api from './visitNotesApi'

describe('VisitNoteEditor', () => {
  it('summarizes and saves notes on submit', async () => {
    const saveSpy = vi.spyOn(api, 'saveVisitNote').mockResolvedValue({ ok: true })
    vi.spyOn(api, 'summarizeNotes').mockResolvedValue({
      clinicalSummary: 'URI, rest advised', patientSummary: 'You have a cold, rest and drink fluids.',
    })
    render(<VisitNoteEditor appointmentId="appt-1" />)
    fireEvent.change(screen.getByLabelText(/raw notes/i), { target: { value: 'cough, congestion, viral URI' } })
    fireEvent.click(screen.getByText(/save/i))

    await waitFor(() => {
      expect(screen.getByText(/cold, rest and drink fluids/)).toBeInTheDocument()
    })
    expect(saveSpy).toHaveBeenCalledWith('appt-1', expect.objectContaining({
      doctorRawNotes: 'cough, congestion, viral URI',
      aiClinicalSummary: 'URI, rest advised',
      aiPatientSummary: 'You have a cold, rest and drink fluids.',
    }))
  })

  it('still saves the raw notes when AI summarization fails, instead of losing them', async () => {
    const saveSpy = vi.spyOn(api, 'saveVisitNote').mockResolvedValue({ ok: true })
    vi.spyOn(api, 'summarizeNotes').mockRejectedValue(new Error('Summarization failed'))
    render(<VisitNoteEditor appointmentId="appt-1" />)
    fireEvent.change(screen.getByLabelText(/raw notes/i), { target: { value: 'cough, congestion, viral URI' } })
    fireEvent.click(screen.getByText(/save/i))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/notes saved.*summary.*unavailable/i)
    })
    expect(saveSpy).toHaveBeenCalledWith('appt-1', expect.objectContaining({
      doctorRawNotes: 'cough, congestion, viral URI',
      aiClinicalSummary: null,
      aiPatientSummary: null,
    }))
  })
})
