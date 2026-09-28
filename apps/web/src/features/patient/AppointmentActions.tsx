import { useState } from 'react'
import { cancelAppointment, rescheduleAppointment } from './appointmentsApi'

export function AppointmentActions({ appointment }: { appointment: { id: string; scheduledAt: string } }) {
  const [cancelled, setCancelled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState(appointment.scheduledAt)
  const [newTime, setNewTime] = useState('')
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)

  async function handleCancel() {
    const result = await cancelAppointment(appointment.id)
    if (result.ok) setCancelled(true)
  }

  async function handleReschedule() {
    setRescheduleError(null)
    const result = await rescheduleAppointment(appointment.id, new Date(newTime).toISOString())
    if (result.ok) {
      setScheduledAt(new Date(newTime).toISOString())
    } else if (result.error === 'slot_taken') {
      setRescheduleError('Sorry, this time slot is no longer available. Please pick another.')
    } else {
      setRescheduleError('Something went wrong. Please try again.')
    }
  }

  if (cancelled) return <p>Appointment cancelled.</p>

  return (
    <div>
      <p>Scheduled for {new Date(scheduledAt).toLocaleString()}</p>
      <label>
        New time
        <input
          aria-label="New time" type="datetime-local"
          value={newTime} onChange={(e) => setNewTime(e.target.value)}
        />
      </label>
      <button onClick={handleReschedule}>Reschedule</button>
      {rescheduleError && <p role="alert">{rescheduleError}</p>}
      <button onClick={handleCancel}>Cancel</button>
    </div>
  )
}
