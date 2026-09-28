import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import * as geminiClient from '../gemini/client'
import { testBearerToken } from '../auth/testAuthToken'

describe('POST /triage', () => {
  it('returns a structured urgency classification', async () => {
    vi.spyOn(geminiClient, 'callGemini').mockResolvedValue({
      urgency: 'soon', suggestedDepartment: 'General Practice',
    })
    const res = await request(app).post('/triage').set('Authorization', testBearerToken()).send({
      symptomText: 'mild headache for 2 days', durationDays: 2, bodyArea: 'head', severity: 3,
    })
    expect(res.status).toBe(200)
    expect(res.body.urgency).toBe('soon')
    expect(res.body.disclaimer).toMatch(/not a diagnosis/i)
  })

  it('marks emergency urgency clearly so the UI can short-circuit', async () => {
    vi.spyOn(geminiClient, 'callGemini').mockResolvedValue({
      urgency: 'emergency', suggestedDepartment: 'Emergency',
    })
    const res = await request(app).post('/triage').set('Authorization', testBearerToken()).send({
      symptomText: 'crushing chest pain radiating to left arm', durationDays: 0, bodyArea: 'chest', severity: 10,
    })
    expect(res.status).toBe(200)
    expect(res.body.urgency).toBe('emergency')
  })

  it('returns a safe fallback when Gemini is unavailable', async () => {
    vi.spyOn(geminiClient, 'callGemini').mockRejectedValue(
      new geminiClient.GeminiUnavailableError('down')
    )
    const res = await request(app).post('/triage').set('Authorization', testBearerToken()).send({
      symptomText: 'sore throat', durationDays: 1, bodyArea: 'throat', severity: 2,
    })
    expect(res.status).toBe(200)
    expect(res.body.urgency).toBe('unknown')
    expect(res.body.disclaimer).toMatch(/call the clinic/i)
  })

  it('treats a malformed or differently-cased urgency string from Gemini as unknown, not pass-through', async () => {
    vi.spyOn(geminiClient, 'callGemini').mockResolvedValue({
      urgency: 'Emergency', suggestedDepartment: 'Emergency',
    })
    const res = await request(app).post('/triage').set('Authorization', testBearerToken()).send({
      symptomText: 'chest pain', durationDays: 0, bodyArea: 'chest', severity: 8,
    })
    expect(res.status).toBe(200)
    expect(res.body.urgency).toBe('unknown')
  })

  it('returns 500 (not a hang) when callGemini throws something other than GeminiUnavailableError', async () => {
    vi.spyOn(geminiClient, 'callGemini').mockRejectedValue(new Error('unexpected bug'))
    const res = await request(app).post('/triage').set('Authorization', testBearerToken()).send({
      symptomText: 'sore throat', durationDays: 1, bodyArea: 'throat', severity: 2,
    })
    expect(res.status).toBe(500)
  })

  it('rejects requests missing required fields', async () => {
    const res = await request(app).post('/triage').set('Authorization', testBearerToken()).send({ symptomText: '' })
    expect(res.status).toBe(400)
  })

  it('rejects requests with no auth token', async () => {
    const res = await request(app).post('/triage').send({
      symptomText: 'sore throat', durationDays: 1, bodyArea: 'throat', severity: 2,
    })
    expect(res.status).toBe(401)
  })
})
