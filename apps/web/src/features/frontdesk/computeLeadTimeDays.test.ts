import { describe, it, expect } from 'vitest'
import { computeLeadTimeDays } from './computeLeadTimeDays'

describe('computeLeadTimeDays', () => {
  it('returns the number of days between when the appointment was booked and when it is scheduled', () => {
    const days = computeLeadTimeDays('2026-09-01T09:00:00Z', '2026-10-01T09:00:00Z')
    expect(days).toBe(30)
  })

  it('never returns a negative number, even if scheduled_at is before created_at', () => {
    const days = computeLeadTimeDays('2026-10-01T09:00:00Z', '2026-09-01T09:00:00Z')
    expect(days).toBe(0)
  })
})
