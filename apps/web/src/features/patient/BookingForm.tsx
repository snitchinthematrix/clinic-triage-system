import { useState } from 'react'
import { bookAppointment } from './appointmentsApi'
import type { TriageResult } from './aiBackendClient'

export function BookingForm({
  doctorId, patientId, scheduledAt, triageResult,
}: { doctorId: string; patientId: string; scheduledAt: string; triageResult?: TriageResult | null }) {
  const [status, setStatus] = useState<'idle' | 'booked' | 'slot_taken' | 'error'>('idle')

  async function handleConfirm() {
    const result = await bookAppointment({ doctorId, patientId, scheduledAt, triageResult })
    if (result.ok) setStatus('booked')
    else if (result.error === 'slot_taken') setStatus('slot_taken')
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
