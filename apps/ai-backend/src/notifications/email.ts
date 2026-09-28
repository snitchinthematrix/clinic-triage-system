export async function sendEmail(to: string, subject: string, body: string): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.NOTIFICATION_FROM_EMAIL ?? 'clinic@example.com'
  if (!apiKey) return { ok: false }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text: body }),
    })
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}
