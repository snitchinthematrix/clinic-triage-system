import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { requireAuth } from './requireAuth'

const TEST_SECRET = 'test-jwt-secret'

function buildApp() {
  const app = express()
  app.get('/protected', requireAuth, (_req, res) => res.json({ ok: true }))
  return app
}

describe('requireAuth', () => {
  it('rejects a request with no Authorization header', async () => {
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET
    const res = await request(buildApp()).get('/protected')
    expect(res.status).toBe(401)
  })

  it('rejects a request with an invalid token', async () => {
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET
    const res = await request(buildApp()).get('/protected').set('Authorization', 'Bearer not-a-real-token')
    expect(res.status).toBe(401)
  })

  it('allows a request with a valid token signed by the configured secret', async () => {
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET
    const token = jwt.sign({ sub: 'user-1', role: 'authenticated' }, TEST_SECRET)
    const res = await request(buildApp()).get('/protected').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})
