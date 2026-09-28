import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface Visit {
  appointment_id: string
  scheduled_at: string
  ai_patient_summary: string | null
}

// patientId is accepted for interface stability (callers pass the signed-in
// user's id) but the query itself no longer uses it: get_my_visit_summaries
// derives the patient from auth.uid() server-side, so a patient can never
// query another patient's visit summaries by passing a different id here.
export function VisitHistory({ patientId: _patientId }: { patientId: string }) {
  const [visits, setVisits] = useState<Visit[]>([])

  useEffect(() => {
    supabase
      .rpc('get_my_visit_summaries')
      .then(({ data }: { data: any }) => {
        if (data) {
          setVisits(
            data.map((row: any) => ({
              appointment_id: row.appointment_id,
              scheduled_at: row.scheduled_at,
              ai_patient_summary: row.ai_patient_summary ?? null,
            }))
          )
        }
      })
  }, [])

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
