import { useState } from 'react'
import { summarizeNotes, saveVisitNote } from './visitNotesApi'

export function VisitNoteEditor({ appointmentId }: { appointmentId: string }) {
  const [rawNotes, setRawNotes] = useState('')
  const [patientSummary, setPatientSummary] = useState('')
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSummaryError(null)
    try {
      const { clinicalSummary, patientSummary: ps } = await summarizeNotes(rawNotes)
      await saveVisitNote(appointmentId, {
        doctorRawNotes: rawNotes, aiClinicalSummary: clinicalSummary, aiPatientSummary: ps,
      })
      setPatientSummary(ps)
    } catch {
      // AI summarization failing must never lose the doctor's raw notes —
      // save them on their own and tell the doctor the summary didn't run.
      await saveVisitNote(appointmentId, {
        doctorRawNotes: rawNotes, aiClinicalSummary: null, aiPatientSummary: null,
      })
      setSummaryError('Notes saved. AI summary is currently unavailable — you can retry later.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <label>
        Raw notes
        <textarea aria-label="Raw notes" value={rawNotes} onChange={(e) => setRawNotes(e.target.value)} />
      </label>
      <button onClick={handleSave} disabled={saving}>Save</button>
      {patientSummary && <p>Patient summary preview: {patientSummary}</p>}
      {summaryError && <p role="alert">{summaryError}</p>}
    </div>
  )
}
