import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export function AvailabilityEditor({ doctorId }: { doctorId: string }) {
  const [mondayStart, setMondayStart] = useState('09:00')
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    const { error } = await supabase
      .from('doctors')
      .update({ working_hours: { monday: { start: mondayStart } } })
      .eq('profile_id', doctorId)
    setSaved(!error)
  }

  return (
    <div>
      <label>
        Monday start
        <input aria-label="Monday start" type="time" value={mondayStart} onChange={(e) => setMondayStart(e.target.value)} />
      </label>
      <button onClick={handleSave}>Save availability</button>
      {saved && <p>Availability saved.</p>}
    </div>
  )
}
