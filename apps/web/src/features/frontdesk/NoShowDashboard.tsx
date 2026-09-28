import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { computeNoShowRisk } from './noShowHeuristic'
import { computeLeadTimeDays } from './computeLeadTimeDays'

interface RiskRow {
  id: string
  patientName: string
  risk: number
}

const HIGH_RISK_THRESHOLD = 0.6

async function fetchPastNoShowCount(patientId: string): Promise<number> {
  // PostgREST treats a bare "count" as a literal column name, not the
  // count aggregate — '*' with the { count: 'exact', head: true } option
  // is the correct way to get a row count without fetching rows.
  const { count } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('status', 'no_show')
  return count ?? 0
}

export function NoShowDashboard({ date }: { date: string }) {
  const [rows, setRows] = useState<RiskRow[]>([])

  useEffect(() => {
    const dayStart = `${date}T00:00:00Z`
    const dayEnd = `${date}T23:59:59Z`
    supabase
      .from('appointments')
      .select('id, scheduled_at, created_at, source, patient_id, patients(profiles(full_name))')
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd)
      .then(async ({ data }: any) => {
        if (!data) return
        const computed = await Promise.all(
          data.map(async (r: any) => {
            const scheduled = new Date(r.scheduled_at)
            // Lead time is how far in advance the appointment was BOOKED,
            // not how far the dashboard's viewed date is from it (rows are
            // already filtered to a single day, so that difference is
            // always ~0 and the factor would never contribute to risk).
            const leadTimeDays = computeLeadTimeDays(r.created_at, r.scheduled_at)
            const pastNoShowCount = await fetchPastNoShowCount(r.patient_id)
            const risk = computeNoShowRisk({
              leadTimeDays,
              dayOfWeek: scheduled.getUTCDay(),
              pastNoShowCount,
              source: r.source,
            })
            return { id: r.id, patientName: r.patients.profiles.full_name, risk }
          })
        )
        setRows(computed)
      })
  }, [date])

  return (
    <ul>
      {rows.map((r) => (
        <li key={r.id}>
          {r.patientName} — {r.risk >= HIGH_RISK_THRESHOLD ? 'High risk' : 'Normal risk'}
        </li>
      ))}
    </ul>
  )
}
