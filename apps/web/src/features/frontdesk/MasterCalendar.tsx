import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface Row {
  id: string
  scheduled_at: string
  doctorName: string
  patientName: string
}

export function MasterCalendar({ date }: { date: string }) {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    const dayStart = `${date}T00:00:00Z`
    const dayEnd = `${date}T23:59:59Z`
    supabase
      .from('appointments')
      .select('id, scheduled_at, doctors(profiles(full_name)), patients(profiles(full_name))')
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd)
      .then(({ data }: any) => {
        if (!data) return
        setRows(
          data.map((r: any) => ({
            id: r.id,
            scheduled_at: r.scheduled_at,
            doctorName: r.doctors.profiles.full_name,
            patientName: r.patients.profiles.full_name,
          }))
        )
      })
  }, [date])

  return (
    <table>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{new Date(r.scheduled_at).toLocaleTimeString()}</td>
            <td>{r.doctorName}</td>
            <td>{r.patientName}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
