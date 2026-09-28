export function computeLeadTimeDays(createdAt: string, scheduledAt: string): number {
  const created = new Date(createdAt).getTime()
  const scheduled = new Date(scheduledAt).getTime()
  return Math.max(0, (scheduled - created) / 86_400_000)
}
