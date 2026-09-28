import { DailyQueue } from './DailyQueue'
import { AvailabilityEditor } from './AvailabilityEditor'

export function DoctorHome({ doctorId }: { doctorId: string }) {
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div>
      <h1>Today's queue</h1>
      <DailyQueue doctorId={doctorId} date={today} />
      <h2>Availability</h2>
      <AvailabilityEditor doctorId={doctorId} />
    </div>
  )
}
