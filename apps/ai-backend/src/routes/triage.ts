import { Router } from 'express'
import { callGemini, GeminiUnavailableError } from '../gemini/client'

export const triageRouter = Router()

const DISCLAIMER =
  'This is not a diagnosis. It is a general guide to help route you to the right care.'

triageRouter.post('/triage', async (req, res) => {
  const { symptomText, durationDays, bodyArea, severity } = req.body ?? {}
  if (!symptomText || typeof severity !== 'number' || !bodyArea) {
    return res.status(400).json({ error: 'symptomText, bodyArea, and severity are required' })
  }

  const prompt = `You are a clinical triage assistant. Given the patient's reported symptoms,
respond with strict JSON: {"urgency": "routine"|"soon"|"urgent"|"emergency", "suggestedDepartment": string}.
Use "emergency" only for symptoms that could be life-threatening (e.g. chest pain, difficulty breathing,
severe bleeding, stroke signs). Symptoms: "${symptomText}". Body area: ${bodyArea}. Duration (days): ${durationDays}.
Self-reported severity (1-10): ${severity}.`

  try {
    const result = await callGemini(prompt, {})
    return res.json({
      urgency: result.urgency,
      suggestedDepartment: result.suggestedDepartment,
      disclaimer: DISCLAIMER,
    })
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      return res.json({
        urgency: 'unknown',
        suggestedDepartment: null,
        disclaimer:
          'We could not automatically assess your symptoms right now. Please call the clinic directly, or call emergency services if this is urgent.',
      })
    }
    throw err
  }
})
