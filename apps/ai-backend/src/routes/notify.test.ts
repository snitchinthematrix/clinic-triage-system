import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import * as email from '../notifications/email'
import { testBearerToken } from '../auth/testAuthToken'

describe('POST /notify/appointment-confirmation', () => {
  it('sends a confirmation email', async () => {
    const spy = vi.spyOn(email, 'sendEmail').mockResolvedValue({ ok: true })
    const res = await request(app).post('/notify/appointment-confirmation').set('Authorization', testBearerToken()).send({
      to: 'patient@example.com', scheduledAt: '2026-10-01T09:00:00Z', doctorName: 'Dr. Lee',
    })
    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith(
      'patient@example.com', expect.stringMatching(/confirmed/i), expect.stringContaining('Dr. Lee')
    )
  })

  it('rejects requests with no auth token', async () => {
    const res = await request(app).post('/notify/appointment-confirmation').send({
      to: 'patient@example.com', scheduledAt: '2026-10-01T09:00:00Z', doctorName: 'Dr. Lee',
    })
    expect(res.status).toBe(401)
  })
})
