import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthedRequest extends Request {
  userId?: string | undefined
}

// Verifies the Supabase-issued access token sent by the SPA, so the AI
// backend's Gemini/Resend-backed endpoints cannot be called anonymously
// from the open internet (they would otherwise let anyone burn the
// clinic's free-tier quota, or send arbitrary email through /notify).
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    return res.status(500).json({ error: 'Server auth is not configured' })
  }

  const header = req.header('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' })
  }

  try {
    const decoded = jwt.verify(token, secret) as { sub?: string }
    req.userId = decoded.sub
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
