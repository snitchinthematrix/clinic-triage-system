import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TriageForm } from './TriageForm'
import * as client from './aiBackendClient'

describe('TriageForm', () => {
  it('shows an emergency banner immediately, before any booking UI, when urgency is emergency', async () => {
    const onComplete = vi.fn()
    vi.spyOn(client, 'submitTriage').mockResolvedValue({
      urgency: 'emergency', suggestedDepartment: 'Emergency', disclaimer: 'not a diagnosis', symptomText: 'chest pain',
    })
    render(<TriageForm onComplete={onComplete} />)
    fireEvent.change(screen.getByLabelText(/describe your symptoms/i), { target: { value: 'chest pain' } })
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: '10' } })
    fireEvent.click(screen.getByText(/submit/i))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/call emergency services/i)
    })
    expect(screen.queryByText(/continue to booking/i)).not.toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('shows the disclaimer and department before continuing, for a routine result', async () => {
    const onComplete = vi.fn()
    vi.spyOn(client, 'submitTriage').mockResolvedValue({
      urgency: 'routine', suggestedDepartment: 'General Practice', disclaimer: 'This is not a diagnosis.', symptomText: 'mild cough',
    })
    render(<TriageForm onComplete={onComplete} />)
    fireEvent.change(screen.getByLabelText(/describe your symptoms/i), { target: { value: 'mild cough' } })
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: '2' } })
    fireEvent.click(screen.getByText(/submit/i))

    await waitFor(() => expect(screen.getByText(/not a diagnosis/i)).toBeInTheDocument())
    expect(screen.getByText(/General Practice/)).toBeInTheDocument()
    // The disclaimer must actually be read, not skipped past automatically.
    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText(/continue to booking/i))
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ urgency: 'routine' }))
  })

  it('shows the "please call the clinic" fallback disclaimer prominently for an unknown-urgency result, not silently', async () => {
    const onComplete = vi.fn()
    vi.spyOn(client, 'submitTriage').mockResolvedValue({
      urgency: 'unknown', suggestedDepartment: null,
      disclaimer: 'We could not automatically assess your symptoms right now. Please call the clinic directly, or call emergency services if this is urgent.',
      symptomText: 'mild cough',
    })
    render(<TriageForm onComplete={onComplete} />)
    fireEvent.change(screen.getByLabelText(/describe your symptoms/i), { target: { value: 'mild cough' } })
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: '2' } })
    fireEvent.click(screen.getByText(/submit/i))

    await waitFor(() => expect(screen.getByText(/call the clinic directly/i)).toBeInTheDocument())
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('shows a fallback message and re-enables the form when the triage request itself fails (network/CORS/5xx)', async () => {
    vi.spyOn(client, 'submitTriage').mockRejectedValue(new Error('Triage request failed'))
    render(<TriageForm onComplete={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/describe your symptoms/i), { target: { value: 'sore throat' } })
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: '2' } })
    fireEvent.click(screen.getByText(/submit/i))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/call the clinic/i)
    })
    expect((screen.getByText(/submit/i) as HTMLButtonElement).disabled).toBe(false)
  })
})
