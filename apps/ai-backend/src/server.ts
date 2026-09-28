import express from 'express'
import cors from 'cors'
import { triageRouter } from './routes/triage'
import { summarizeRouter } from './routes/summarize'
import { notifyRouter } from './routes/notify'
import { requireAuth } from './auth/requireAuth'

export const app = express()
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173'
app.use(cors({ origin: allowedOrigin }))
app.use(express.json())
// Every AI/notification endpoint costs money (Gemini/Resend quota) or can
// send email on the clinic's behalf, so all of them require a valid
// Supabase-issued access token — see src/auth/requireAuth.ts. Scoped by
// path (not a bare app.use(requireAuth)) so /health stays public.
app.use('/triage', requireAuth)
app.use('/summarize-visit', requireAuth)
app.use('/notify', requireAuth)
app.use(triageRouter)
app.use(summarizeRouter)
app.use(notifyRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

if (require.main === module) {
  const port = process.env.PORT ?? 4000
  app.listen(port, () => console.log(`AI backend listening on ${port}`))
}
