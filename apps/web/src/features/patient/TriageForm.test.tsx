import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TriageForm } from './TriageForm'
import * as client from './aiBackendClient'

describe('TriageForm', () => {
  it('shows an emergency banner immediately, before any booking UI, when urgency is emergency', async () => {
    vi.spyOn(client, 'submitTriage').mockResolvedValue({
      urgency: 'emergency', suggestedDepartment: 'Emergency', disclaimer: 'not a diagnosis', symptomText: 'chest pain',
    })
    render(<TriageForm onComplete={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/describe your symptoms/i), { target: { value: 'chest pain' } })
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: '10' } })
    fireEvent.click(screen.getByText(/submit/i))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/call emergency services/i)
    })
    expect(screen.queryByText(/book appointment/i)).not.toBeInTheDocument()
  })

  it('calls onComplete with the result for non-emergency urgency', async () => {
    const onComplete = vi.fn()
    vi.spyOn(client, 'submitTriage').mockResolvedValue({
      urgency: 'routine', suggestedDepartment: 'General Practice', disclaimer: 'not a diagnosis', symptomText: 'mild cough',
    })
    render(<TriageForm onComplete={onComplete} />)
    fireEvent.change(screen.getByLabelText(/describe your symptoms/i), { target: { value: 'mild cough' } })
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: '2' } })
    fireEvent.click(screen.getByText(/submit/i))

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ urgency: 'routine' })
    ))
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
