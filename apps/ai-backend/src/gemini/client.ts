export class GeminiUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeminiUnavailableError'
  }
}

// gemini-1.5-flash was retired by Google (found by testing against the
// real API — it now 404s). "gemini-flash-latest" is Google's own alias
// for the current recommended flash model, chosen so this doesn't need a
// code change again next time a model is retired. GEMINI_MODEL overrides
// it without a deploy, for when it does need to be pinned to a specific
// version.
function geminiUrl(): string {
  const model = process.env.GEMINI_MODEL ?? 'gemini-flash-latest'
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

export async function callGemini(prompt: string, _schema: object): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new GeminiUnavailableError('GEMINI_API_KEY is not configured')

  let response: Response
  try {
    response = await fetch(`${geminiUrl()}?key=${apiKey}`, {
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
