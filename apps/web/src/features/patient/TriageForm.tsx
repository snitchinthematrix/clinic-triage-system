import { useState, type FormEvent } from 'react'
import { submitTriage, type TriageResult } from './aiBackendClient'

export function TriageForm({ onComplete }: { onComplete: (result: TriageResult) => void }) {
  const [symptomText, setSymptomText] = useState('')
  const [bodyArea, setBodyArea] = useState('')
  const [durationDays, setDurationDays] = useState(1)
  const [severity, setSeverity] = useState(1)
  const [emergency, setEmergency] = useState(false)
  const [result, setResult] = useState<TriageResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    try {
      const triageResult = await submitTriage({ symptomText, bodyArea, durationDays, severity })
      if (triageResult.urgency === 'emergency') {
        setEmergency(true)
        return
      }
      // Show the disclaimer (and, for an 'unknown' result, the "please
      // call the clinic" fallback message) before ever reaching booking —
      // previously onComplete fired immediately and this text was never
      // shown to the patient at all.
      setResult(triageResult)
    } catch {
      setSubmitError(
        'We could not reach the clinic to assess your symptoms right now. Please call the clinic directly, or call emergency services if this is urgent.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (emergency) {
    return (
      <p role="alert">
        Your symptoms may be a medical emergency. Please call emergency services (911) or go to
        the nearest emergency room immediately. Do not wait for an appointment.
      </p>
    )
  }

  if (result) {
    return (
      <div>
        <p>{result.disclaimer}</p>
        {result.suggestedDepartment && <p>Suggested department: {result.suggestedDepartment}</p>}
        <button onClick={() => onComplete(result)}>Continue to booking</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Describe your symptoms
        <textarea
          aria-label="Describe your symptoms"
          value={symptomText}
          onChange={(e) => setSymptomText(e.target.value)}
          required
        />
      </label>
      <label>
        Body area
        <input aria-label="Body area" value={bodyArea} onChange={(e) => setBodyArea(e.target.value)} />
      </label>
      <label>
        Duration (days)
        <input
          aria-label="Duration (days)" type="number" min={0}
          value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))}
        />
      </label>
      <label>
        Severity (1-10)
        <input
          aria-label="Severity" type="number" min={1} max={10}
          value={severity} onChange={(e) => setSeverity(Number(e.target.value))}
        />
      </label>
      <button type="submit" disabled={submitting}>Submit</button>
      {submitError && <p role="alert">{submitError}</p>}
    </form>
  )
}
