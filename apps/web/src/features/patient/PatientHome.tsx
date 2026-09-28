import { VisitHistory } from './VisitHistory'

// Note: this deliberately does not include a doctor/slot picker leading
// into PatientBookingPage — no task in the plan ever specified that UI, so
// building it is new-feature work rather than wiring, and is tracked as a
// deferred gap rather than silently left unreachable.
export function PatientHome({ patientId }: { patientId: string }) {
  return (
    <div>
      <h1>Your visit history</h1>
      <VisitHistory patientId={patientId} />
    </div>
  )
}
