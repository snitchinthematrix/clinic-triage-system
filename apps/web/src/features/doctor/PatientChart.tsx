import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export function PatientChart({ patientId }: { patientId: string }) {
  const [name, setName] = useState('')
  const [latestSymptom, setLatestSymptom] = useState('')

  useEffect(() => {
    supabase
      .from('patients')
      .select('profiles(full_name)')
      .eq('profile_id', patientId)
      .single()
      .then(({ data }: any) => setName(data?.profiles?.full_name ?? ''))

    supabase
      .from('triage_submissions')
      .select('symptom_text')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }: any) => setLatestSymptom(data?.[0]?.symptom_text ?? ''))
  }, [patientId])

  return (
    <div>
      <h2>{name}</h2>
      {latestSymptom && <p>Latest reported symptoms: {latestSymptom}</p>}
    </div>
  )
}
