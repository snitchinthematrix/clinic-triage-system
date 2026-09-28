import { supabase } from '../../lib/supabaseClient'

const AI_BACKEND_URL = import.meta.env.VITE_AI_BACKEND_URL

export async function summarizeNotes(rawNotes: string) {
  const { data } = await supabase.auth.getSession()
  const res = await fetch(`${AI_BACKEND_URL}/summarize-visit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    },
    body: JSON.stringify({ rawNotes }),
  })
  if (!res.ok) throw new Error('Summarization failed')
  return res.json() as Promise<{ clinicalSummary: string; patientSummary: string }>
}

export async function saveVisitNote(
  appointmentId: string,
  data: { doctorRawNotes: string; aiClinicalSummary: string | null; aiPatientSummary: string | null }
): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('visit_notes').upsert({
    appointment_id: appointmentId,
    doctor_raw_notes: data.doctorRawNotes,
    ai_structured_summary: data.aiClinicalSummary,
    ai_patient_summary: data.aiPatientSummary,
  })
  return { ok: !error }
}
