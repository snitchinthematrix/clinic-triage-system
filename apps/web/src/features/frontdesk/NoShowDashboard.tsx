import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { computeNoShowRisk } from './noShowHeuristic'

interface RiskRow {
  id: string
  patientName: string
  risk: number
}

const HIGH_RISK_THRESHOLD = 0.6

async function fetchPastNoShowCount(patientId: string): Promise<number> {
  const { count } = await supabase
    .from('appointments')
    .select('id, count', { count: 'exact', head: true })
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
      .select('id, scheduled_at, source, patient_id, patients(profiles(full_name))')
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd)
      .then(async ({ data }: any) => {
        if (!data) return
        const now = new Date(date)
        const computed = await Promise.all(
          data.map(async (r: any) => {
            const scheduled = new Date(r.scheduled_at)
            const leadTimeDays = Math.max(0, (scheduled.getTime() - now.getTime()) / 86_400_000)
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
