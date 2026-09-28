export class GeminiUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeminiUnavailableError'
  }
}

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function callGemini(prompt: string, _schema: object): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new GeminiUnavailableError('GEMINI_API_KEY is not configured')

  let response: Response
  try {
    response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    throw new GeminiUnavailableError(`Gemini request failed: ${(err as Error).message}`)
  }

  if (!response.ok) {
    throw new GeminiUnavailableError(`Gemini returned status ${response.status}`)
  }

  let body: any
  try {
    body = await response.json()
  } catch {
    throw new GeminiUnavailableError('Gemini response body was not valid JSON')
  }
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new GeminiUnavailableError('Gemini response had no content')

  try {
    return JSON.parse(text)
  } catch {
    throw new GeminiUnavailableError('Gemini response was not valid JSON')
  }
}
