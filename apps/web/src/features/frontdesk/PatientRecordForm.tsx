import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export function PatientRecordForm({
  patientId, initialInsuranceInfo, initialFullName, initialPhone,
}: { patientId: string; initialInsuranceInfo: string; initialFullName: string; initialPhone: string }) {
  const [insuranceInfo, setInsuranceInfo] = useState(initialInsuranceInfo)
  const [fullName, setFullName] = useState(initialFullName)
  const [phone, setPhone] = useState(initialPhone)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    const [patientsResult, profilesResult] = await Promise.all([
      supabase.from('patients').update({ insurance_info: insuranceInfo }).eq('profile_id', patientId),
      supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', patientId),
    ])
    setSaved(!patientsResult.error && !profilesResult.error)
  }

  return (
    <div>
      <label>
        Full name
        <input aria-label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </label>
      <label>
        Phone
        <input aria-label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label>
        Insurance info
        <input aria-label="Insurance info" value={insuranceInfo} onChange={(e) => setInsuranceInfo(e.target.value)} />
      </label>
      <button onClick={handleSave}>Save</button>
      {saved && <p>Saved.</p>}
    </div>
  )
}
