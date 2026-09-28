import { Router } from 'express'
import { callGemini, GeminiUnavailableError } from '../gemini/client'

export const summarizeRouter = Router()

summarizeRouter.post('/summarize-visit', async (req, res) => {
  const { rawNotes } = req.body ?? {}
  if (!rawNotes || typeof rawNotes !== 'string') {
    return res.status(400).json({ error: 'rawNotes is required' })
  }

  const prompt = `You are a clinical scribe assistant. Given a doctor's raw visit notes, respond with
strict JSON: {"clinicalSummary": string, "patientSummary": string}. clinicalSummary is a concise
structured note for the medical record. patientSummary is a plain-language explanation for the patient,
written at an 8th-grade reading level, including any follow-up instructions. Raw notes: "${rawNotes}"`

  try {
    const result = await callGemini(prompt, {})
    return res.json({
      clinicalSummary: result.clinicalSummary,
      patientSummary: result.patientSummary,
    })
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      return res.status(502).json({ error: 'AI summarization is temporarily unavailable' })
    }
    throw err
  }
})
