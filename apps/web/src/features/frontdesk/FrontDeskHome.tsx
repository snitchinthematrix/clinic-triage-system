import { MasterCalendar } from './MasterCalendar'
import { NoShowDashboard } from './NoShowDashboard'

export function FrontDeskHome() {
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div>
      <h1>Today's calendar</h1>
      <MasterCalendar date={today} />
      <h2>No-show risk</h2>
      <NoShowDashboard date={today} />
    </div>
  )
}
