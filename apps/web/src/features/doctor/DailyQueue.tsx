import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const URGENCY_ORDER: Record<string, number> = { emergency: 0, urgent: 1, soon: 2, routine: 3 }

interface QueueItem {
  id: string
  scheduled_at: string
  urgency_level: string | null
  patientName: string
}

export function DailyQueue({ doctorId, date }: { doctorId: string; date: string }) {
  const [items, setItems] = useState<QueueItem[]>([])

  useEffect(() => {
    const dayStart = `${date}T00:00:00Z`
    const dayEnd = `${date}T23:59:59Z`
    supabase
      .from('appointments')
      .select('id, scheduled_at, urgency_level, patients(profiles(full_name))')
      .eq('doctor_id', doctorId)
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd)
      .in('status', ['booked', 'checked_in', 'in_progress'])
      .order('scheduled_at', { ascending: true })
      .then(({ data }: { data: any }) => {
        if (!data) return
        const sorted = [...data].sort(
          (a: any, b: any) =>
            (URGENCY_ORDER[a.urgency_level ?? 'routine'] ?? 3) -
            (URGENCY_ORDER[b.urgency_level ?? 'routine'] ?? 3)
        )
        setItems(
          sorted.map((row: any) => ({
            id: row.id,
            scheduled_at: row.scheduled_at,
            urgency_level: row.urgency_level,
            patientName: row.patients.profiles.full_name,
          }))
        )
      })
  }, [doctorId, date])

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <span data-testid="patient-name">{item.patientName}</span>
          <span>{item.urgency_level ?? 'routine'}</span>
        </li>
      ))}
    </ul>
  )
}
