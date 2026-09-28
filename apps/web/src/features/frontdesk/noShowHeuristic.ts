export interface NoShowInput {
  leadTimeDays: number
  dayOfWeek: number // 0 = Sunday
  pastNoShowCount: number
  source: 'self_booked' | 'front_desk'
}

export function computeNoShowRisk(input: NoShowInput): number {
  let score = 0.1

  score += Math.min(input.leadTimeDays / 30, 1) * 0.3
  score += Math.min(input.pastNoShowCount * 0.15, 0.5)
  if (input.dayOfWeek === 0 || input.dayOfWeek === 6) score += 0.1
  if (input.source === 'self_booked') score += 0.05

  return Math.max(0, Math.min(1, score))
}
