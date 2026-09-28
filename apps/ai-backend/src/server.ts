import express from 'express'
import cors from 'cors'
import { triageRouter } from './routes/triage'
import { summarizeRouter } from './routes/summarize'
import { notifyRouter } from './routes/notify'

export const app = express()
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173'
app.use(cors({ origin: allowedOrigin }))
app.use(express.json())
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
