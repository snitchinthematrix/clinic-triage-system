import type { NextFunction, Request, Response } from 'express'
import { jwtVerify, createRemoteJWKSet, decodeProtectedHeader } from 'jose'

export interface AuthedRequest extends Request {
  userId?: string | undefined
}

// Supabase projects sign access tokens one of two ways, and a project can
// switch between them: the legacy shared "JWT secret" (alg HS256), or —
// on newer projects, including the one this app was deployed against —
// an asymmetric signing key (alg ES256/RS256) discoverable via
// /auth/v1/.well-known/jwks.json. jwt.verify(token, secret) can only ever
// validate the first kind; a token from a JWKS-signing project fails with
// "invalid signature" no matter what secret value is configured. This was
// found by testing against the real deployed project, not by inspection.
// Cached lazily so the JWKS is fetched once (and re-fetched by jose only
// when an unrecognized kid shows up, e.g. after key rotation).
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined

function getJwks() {
  if (!jwks) {
    const supabaseUrl = process.env.SUPABASE_URL
    if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured')
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`))
  }
  return jwks
}

// Verifies the Supabase-issued access token sent by the SPA, so the AI
// backend's Gemini/Resend-backed endpoints cannot be called anonymously
// from the open internet (they would otherwise let anyone burn the
// clinic's free-tier quota, or send arbitrary email through /notify).
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.header('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' })
  }

  try {
    const { alg } = decodeProtectedHeader(token)
    let sub: string | undefined

    if (alg === 'HS256') {
      const secret = process.env.SUPABASE_JWT_SECRET
      if (!secret) return res.status(500).json({ error: 'Server auth is not configured' })
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
      sub = payload.sub
    } else {
      const { payload } = await jwtVerify(token, getJwks())
      sub = payload.sub
    }

    req.userId = sub
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
