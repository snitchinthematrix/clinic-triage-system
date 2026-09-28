import { useState } from 'react'
import { TriageForm } from './TriageForm'
import { BookingForm } from './BookingForm'
import type { TriageResult } from './aiBackendClient'

export function PatientBookingPage({
  doctorId, patientId, scheduledAt,
}: { doctorId: string; patientId: string; scheduledAt: string }) {
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null)

  if (!triageResult) {
    return <TriageForm onComplete={setTriageResult} />
  }

  return (
    <BookingForm
      doctorId={doctorId}
      patientId={patientId}
      scheduledAt={scheduledAt}
      triageResult={triageResult}
    />
  )
}
