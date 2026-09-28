import { Router } from 'express'
import { sendEmail } from '../notifications/email'
import { asyncHandler } from '../asyncHandler'

export const notifyRouter = Router()

notifyRouter.post(
  '/notify/appointment-confirmation',
  asyncHandler(async (req, res) => {
    const { to, scheduledAt, doctorName } = req.body ?? {}
    if (!to || !scheduledAt || !doctorName) return res.status(400).json({ error: 'missing fields' })
    const when = new Date(scheduledAt).toLocaleString()
    const result = await sendEmail(
      to, 'Your appointment is confirmed',
      `Your appointment with ${doctorName} is confirmed for ${when}.`
    )
    res.json(result)
  })
)

notifyRouter.post(
  '/notify/appointment-reminder',
  asyncHandler(async (req, res) => {
    const { to, scheduledAt, doctorName } = req.body ?? {}
    if (!to || !scheduledAt || !doctorName) return res.status(400).json({ error: 'missing fields' })
    const when = new Date(scheduledAt).toLocaleString()
    const result = await sendEmail(
      to, 'Appointment reminder',
      `Reminder: you have an appointment with ${doctorName} at ${when}.`
    )
    res.json(result)
  })
)
