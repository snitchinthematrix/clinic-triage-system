import { describe, it, expect, vi } from 'vitest'
import { bookAppointment } from './appointmentsApi'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }))

describe('bookAppointment', () => {
  it('books the appointment and persists the triage result atomically via a single RPC call', async () => {
    ;(supabase.rpc as any).mockResolvedValue({ data: 'appt-1', error: null })

    const result = await bookAppointment({
      doctorId: 'doc-1',
      patientId: 'pat-1',
      scheduledAt: '2026-10-01T09:00:00Z',
      triageResult: {
        urgency: 'soon', suggestedDepartment: 'General Practice', disclaimer: 'x', symptomText: 'cough',
      },
    })

    expect(result).toEqual({ ok: true, appointmentId: 'appt-1' })
    expect(supabase.rpc).toHaveBeenCalledWith('book_appointment_with_triage', {
      p_doctor_id: 'doc-1',
      p_patient_id: 'pat-1',
      p_scheduled_at: '2026-10-01T09:00:00Z',
      p_source: 'self_booked',
      p_urgency_level: 'soon',
      p_symptom_text: 'cough',
      p_suggested_department: 'General Practice',
      p_raw_response: expect.objectContaining({ urgency: 'soon' }),
    })
  })

  it('maps a unique-violation error to slot_taken', async () => {
    ;(supabase.rpc as any).mockResolvedValue({ data: null, error: { code: '23505' } })
    const result = await bookAppointment({ doctorId: 'doc-1', patientId: 'pat-1', scheduledAt: '2026-10-01T09:00:00Z' })
    expect(result).toEqual({ ok: false, error: 'slot_taken' })
  })

  it('books without a triage result (front-desk booking with no prior triage)', async () => {
    ;(supabase.rpc as any).mockResolvedValue({ data: 'appt-2', error: null })
    const result = await bookAppointment({ doctorId: 'doc-1', patientId: 'pat-1', scheduledAt: '2026-10-01T09:00:00Z' })
    expect(result).toEqual({ ok: true, appointmentId: 'appt-2' })
    expect(supabase.rpc).toHaveBeenCalledWith('book_appointment_with_triage', expect.objectContaining({
      p_urgency_level: null, p_symptom_text: null,
    }))
  })
})
