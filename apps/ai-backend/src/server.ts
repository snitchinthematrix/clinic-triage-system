import express from 'express'
import { triageRouter } from './routes/triage'
import { summarizeRouter } from './routes/summarize'

export const app = express()
app.use(express.json())
app.use(triageRouter)
app.use(summarizeRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

if (require.main === module) {
  const port = process.env.PORT ?? 4000
  app.listen(port, () => console.log(`AI backend listening on ${port}`))
}
