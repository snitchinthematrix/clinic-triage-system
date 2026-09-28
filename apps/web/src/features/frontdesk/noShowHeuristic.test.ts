import { describe, it, expect } from 'vitest'
import { computeNoShowRisk } from './noShowHeuristic'

describe('computeNoShowRisk', () => {
  it('scores low risk for a front-desk-booked appointment with no history and short lead time', () => {
    const risk = computeNoShowRisk({
      leadTimeDays: 1, dayOfWeek: 2, pastNoShowCount: 0, source: 'front_desk',
    })
    expect(risk).toBeLessThan(0.3)
  })

  it('scores high risk for a patient with prior no-shows and a long lead time', () => {
    const risk = computeNoShowRisk({
      leadTimeDays: 30, dayOfWeek: 1, pastNoShowCount: 3, source: 'self_booked',
    })
    expect(risk).toBeGreaterThan(0.6)
  })

  it('always returns a value between 0 and 1', () => {
    const risk = computeNoShowRisk({ leadTimeDays: 365, dayOfWeek: 6, pastNoShowCount: 10, source: 'self_booked' })
    expect(risk).toBeGreaterThanOrEqual(0)
    expect(risk).toBeLessThanOrEqual(1)
  })
})
