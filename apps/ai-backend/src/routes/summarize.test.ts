import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import * as geminiClient from '../gemini/client'

describe('POST /summarize-visit', () => {
  it('returns clinical and patient-facing summaries', async () => {
    vi.spyOn(geminiClient, 'callGemini').mockResolvedValue({
      clinicalSummary: 'Pt presents with URI symptoms, afebrile, prescribed rest and fluids.',
      patientSummary: 'You have a mild upper respiratory infection. Rest, drink fluids, follow up if worse.',
    })
    const res = await request(app).post('/summarize-visit').send({
      rawNotes: 'pt c/o cough, congestion x3d, no fever, lungs clear, dx viral URI, rest+fluids',
    })
    expect(res.status).toBe(200)
    expect(res.body.clinicalSummary).toContain('URI')
    expect(res.body.patientSummary).toMatch(/respiratory infection/)
  })

  it('rejects empty notes', async () => {
    const res = await request(app).post('/summarize-visit').send({ rawNotes: '' })
    expect(res.status).toBe(400)
  })

  it('returns 502 when Gemini is unavailable', async () => {
    vi.spyOn(geminiClient, 'callGemini').mockRejectedValue(
      new geminiClient.GeminiUnavailableError('down')
    )
    const res = await request(app).post('/summarize-visit').send({ rawNotes: 'some notes' })
    expect(res.status).toBe(502)
  })
})
