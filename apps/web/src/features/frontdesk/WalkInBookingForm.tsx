import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { bookAppointment } from '../patient/appointmentsApi'

interface Doctor {
  id: string
  name: string
}

interface PatientMatch {
  id: string
  name: string
}

export function WalkInBookingForm() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [doctorId, setDoctorId] = useState('')
  const [patientQuery, setPatientQuery] = useState('')
  const [patientMatches, setPatientMatches] = useState<PatientMatch[]>([])
  const [patientId, setPatientId] = useState('')
  const [selectedPatientName, setSelectedPatientName] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [status, setStatus] = useState<'idle' | 'booked' | 'slot_taken' | 'error'>('idle')

  useEffect(() => {
    supabase
      .from('doctors')
      .select('profile_id, profiles(full_name)')
      .then(({ data }: any) => {
        if (data) setDoctors(data.map((d: any) => ({ id: d.profile_id, name: d.profiles.full_name })))
      })
  }, [])

  useEffect(() => {
    if (!patientQuery || patientQuery === selectedPatientName) {
      setPatientMatches([])
      return
    }
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'patient')
      .ilike('full_name', `%${patientQuery}%`)
      .then(({ data }: any) => {
        setPatientMatches((data ?? []).map((p: any) => ({ id: p.id, name: p.full_name })))
      })
  }, [patientQuery, selectedPatientName])

  function selectPatient(match: PatientMatch) {
    setPatientId(match.id)
    setSelectedPatientName(match.name)
    setPatientQuery(match.name)
    setPatientMatches([])
  }

  async function handleBook() {
    const result = await bookAppointment({
      doctorId, patientId, scheduledAt: new Date(scheduledAt).toISOString(), source: 'front_desk',
    })
    if (result.ok) setStatus('booked')
    else if (result.error === 'slot_taken') setStatus('slot_taken')
    else setStatus('error')
  }

  if (status === 'booked') return <p>Appointment booked.</p>

  return (
    <div>
      <label>
        Doctor
        <select aria-label="Doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
          <option value="">Select a doctor</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>
      <label>
        Search patient
        <input
          aria-label="Search patient" value={patientQuery}
          onChange={(e) => { setPatientQuery(e.target.value); setPatientId('') }}
        />
      </label>
      {patientMatches.length > 0 && (
        <ul>
          {patientMatches.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => selectPatient(p)}>{p.name}</button>
            </li>
          ))}
        </ul>
      )}
      <label>
        Time
        <input
          aria-label="Time" type="datetime-local"
          value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
        />
      </label>
      <button onClick={handleBook} disabled={!doctorId || !patientId || !scheduledAt}>Book</button>
      {status === 'slot_taken' && (
        <p role="alert">Sorry, this time slot is no longer available. Please pick another.</p>
      )}
      {status === 'error' && <p role="alert">Something went wrong. Please try again.</p>}
    </div>
  )
}
