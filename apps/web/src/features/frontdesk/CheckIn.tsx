import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export function CheckIn({ appointmentId, patientName }: { appointmentId: string; patientName: string }) {
  const [checkedIn, setCheckedIn] = useState(false)

  async function handleCheckIn() {
    const { error } = await supabase.from('appointments').update({ status: 'checked_in' }).eq('id', appointmentId)
    if (!error) setCheckedIn(true)
  }

  return (
    <div>
      <span>{patientName}</span>
      {checkedIn ? <span>Checked in</span> : <button onClick={handleCheckIn}>Check in</button>}
    </div>
  )
}
