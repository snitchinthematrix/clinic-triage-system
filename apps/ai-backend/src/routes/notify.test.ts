import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import * as email from '../notifications/email'

describe('POST /notify/appointment-confirmation', () => {
  it('sends a confirmation email', async () => {
    const spy = vi.spyOn(email, 'sendEmail').mockResolvedValue({ ok: true })
    const res = await request(app).post('/notify/appointment-confirmation').send({
      to: 'patient@example.com', scheduledAt: '2026-10-01T09:00:00Z', doctorName: 'Dr. Lee',
    })
    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith(
      'patient@example.com', expect.stringMatching(/confirmed/i), expect.stringContaining('Dr. Lee')
    )
  })
})
