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

  // The appointment insert and the triage_submissions insert happen inside
  // a single Postgres function (book_appointment_with_triage) so they
  // commit or fail together — previously these were two separate client
  // round-trips, and a failure on the second one silently left an
  // appointment with no triage record and no error surfaced to the caller.
  const { data, error } = await supabase.rpc('book_appointment_with_triage', {
    p_doctor_id: input.doctorId,
    p_patient_id: input.patientId,
    p_scheduled_at: input.scheduledAt,
    p_source: 'self_booked',
    p_urgency_level: urgency,
    p_symptom_text: input.triageResult?.symptomText ?? null,
    p_suggested_department: input.triageResult?.suggestedDepartment ?? null,
    p_raw_response: input.triageResult ?? null,
  })

  if (error) {
    // Postgres unique_violation code from the (doctor_id, scheduled_at) constraint
    if (error.code === '23505') return { ok: false, error: 'slot_taken' }
    return { ok: false, error: 'unknown' }
  }

  return { ok: true, appointmentId: data }
}

export async function rescheduleAppointment(id: string, newTime: string): Promise<BookResult> {
  const { error } = await supabase.from('appointments').update({ scheduled_at: newTime }).eq('id', id)
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'slot_taken' }
    return { ok: false, error: 'unknown' }
  }
  return { ok: true, appointmentId: id }
}

export async function cancelAppointment(id: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id)
  return { ok: !error }
}
