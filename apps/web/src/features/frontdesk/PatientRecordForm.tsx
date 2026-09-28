import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export function PatientRecordForm({
  patientId, initialInsuranceInfo,
}: { patientId: string; initialInsuranceInfo: string }) {
  const [insuranceInfo, setInsuranceInfo] = useState(initialInsuranceInfo)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    const { error } = await supabase.from('patients').update({ insurance_info: insuranceInfo }).eq('profile_id', patientId)
    setSaved(!error)
  }

  return (
    <div>
      <label>
        Insurance info
        <input aria-label="Insurance info" value={insuranceInfo} onChange={(e) => setInsuranceInfo(e.target.value)} />
      </label>
      <button onClick={handleSave}>Save</button>
      {saved && <p>Saved.</p>}
    </div>
  )
}
