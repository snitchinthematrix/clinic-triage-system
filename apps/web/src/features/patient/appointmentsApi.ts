import { supabase } from '../../lib/supabaseClient'
import type { TriageResult } from './aiBackendClient'

export type BookResult =
  | { ok: true; appointmentId: string }
  | { ok: false; error: 'slot_taken' | 'unknown' }

export async function bookAppointment(input: {
  doctorId: string
  patientId: string
  scheduledAt: string
  triageResult?: TriageResult | null
}): Promise<BookResult> {
  const urgency =
    input.triageResult && input.triageResult.urgency !== 'unknown' ? input.triageResult.urgency : null

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      doctor_id: input.doctorId,
      patient_id: input.patientId,
      scheduled_at: input.scheduledAt,
      source: 'self_booked',
      urgency_level: urgency,
    })
    .select('id')
    .single()

  if (error) {
    // Postgres unique_violation code from the (doctor_id, scheduled_at) constraint
    if (error.code === '23505') return { ok: false, error: 'slot_taken' }
    return { ok: false, error: 'unknown' }
  }

  if (input.triageResult) {
    await supabase.from('triage_submissions').insert({
      patient_id: input.patientId,
      appointment_id: data.id,
      symptom_text: input.triageResult.symptomText,
      ai_urgency: urgency,
      ai_suggested_department: input.triageResult.suggestedDepartment,
      ai_raw_response: input.triageResult,
    })
  }

  return { ok: true, appointmentId: data.id }
}
