import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface Visit {
  appointment_id: string
  scheduled_at: string
  ai_patient_summary: string | null
}

export function VisitHistory({ patientId }: { patientId: string }) {
  const [visits, setVisits] = useState<Visit[]>([])

  useEffect(() => {
    supabase
      .from('appointments')
      .select('id, scheduled_at, visit_notes(ai_patient_summary)')
      .eq('patient_id', patientId)
      .order('scheduled_at', { ascending: false })
      .then(({ data }: { data: any }) => {
        if (data) {
          setVisits(
            data.map((row: any) => ({
              appointment_id: row.appointment_id ?? row.id,
              scheduled_at: row.scheduled_at,
              ai_patient_summary: row.ai_patient_summary ?? row.visit_notes?.ai_patient_summary ?? null,
            }))
          )
        }
      })
  }, [patientId])

  return (
    <ul>
      {visits.map((v) => (
        <li key={v.appointment_id}>
          <p>{new Date(v.scheduled_at).toLocaleDateString()}</p>
          {v.ai_patient_summary && <p>{v.ai_patient_summary}</p>}
        </li>
      ))}
    </ul>
  )
}
