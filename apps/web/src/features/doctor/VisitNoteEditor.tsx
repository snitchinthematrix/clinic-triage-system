import { useState } from 'react'
import { summarizeNotes, saveVisitNote } from './visitNotesApi'

export function VisitNoteEditor({ appointmentId }: { appointmentId: string }) {
  const [rawNotes, setRawNotes] = useState('')
  const [patientSummary, setPatientSummary] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const { clinicalSummary, patientSummary: ps } = await summarizeNotes(rawNotes)
    await saveVisitNote(appointmentId, {
      doctorRawNotes: rawNotes, aiClinicalSummary: clinicalSummary, aiPatientSummary: ps,
    })
    setPatientSummary(ps)
    setSaving(false)
  }

  return (
    <div>
      <label>
        Raw notes
        <textarea aria-label="Raw notes" value={rawNotes} onChange={(e) => setRawNotes(e.target.value)} />
      </label>
      <button onClick={handleSave} disabled={saving}>Save</button>
      {patientSummary && <p>Patient summary preview: {patientSummary}</p>}
    </div>
  )
}
