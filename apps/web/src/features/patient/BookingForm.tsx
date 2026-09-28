import { useState } from 'react'
import { bookAppointment } from './appointmentsApi'
import { sendBookingConfirmation, type TriageResult } from './aiBackendClient'
import { supabase } from '../../lib/supabaseClient'

async function notifyBookingConfirmed(doctorId: string, scheduledAt: string) {
  // Best-effort: the appointment is already booked regardless of whether
  // this succeeds, so a failure here must never affect the "booked"
  // status the patient sees.
  try {
    const [{ data: doctorRow }, { data: userData }] = await Promise.all([
      supabase.from('doctors').select('profiles(full_name)').eq('profile_id', doctorId).single(),
      supabase.auth.getUser(),
    ])
    const doctorName = (doctorRow as any)?.profiles?.full_name
    const to = userData.user?.email
    if (doctorName && to) {
      await sendBookingConfirmation({ to, scheduledAt, doctorName })
    }
  } catch {
    // swallowed deliberately — see comment above
  }
}

export function BookingForm({
  doctorId, patientId, scheduledAt, triageResult,
}: { doctorId: string; patientId: string; scheduledAt: string; triageResult?: TriageResult | null }) {
  const [status, setStatus] = useState<'idle' | 'booked' | 'slot_taken' | 'error'>('idle')

  async function handleConfirm() {
    const result = await bookAppointment({ doctorId, patientId, scheduledAt, triageResult })
    if (result.ok) {
      setStatus('booked')
      void notifyBookingConfirmed(doctorId, scheduledAt)
    } else if (result.error === 'slot_taken') setStatus('slot_taken')
    else setStatus('error')
  }

  if (status === 'booked') return <p>Appointment booked for {new Date(scheduledAt).toLocaleString()}.</p>
  if (status === 'slot_taken') {
    return <p role="alert">Sorry, this time slot is no longer available. Please pick another.</p>
  }

  return (
    <div>
      <p>Confirm appointment on {new Date(scheduledAt).toLocaleString()}?</p>
      <button onClick={handleConfirm}>Confirm booking</button>
      {status === 'error' && <p role="alert">Something went wrong. Please try again.</p>}
    </div>
  )
}
