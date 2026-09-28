import { useState } from 'react'
import { cancelAppointment } from './appointmentsApi'

export function AppointmentActions({ appointment }: { appointment: { id: string; scheduledAt: string } }) {
  const [cancelled, setCancelled] = useState(false)

  async function handleCancel() {
    const result = await cancelAppointment(appointment.id)
    if (result.ok) setCancelled(true)
  }

  if (cancelled) return <p>Appointment cancelled.</p>

  return <button onClick={handleCancel}>Cancel</button>
}
