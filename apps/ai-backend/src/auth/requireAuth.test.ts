import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import * as jose from 'jose'
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

  it('allows a request with a valid token signed by the configured secret (legacy HS256 projects)', async () => {
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET
    const token = jwt.sign({ sub: 'user-1', role: 'authenticated' }, TEST_SECRET)
    const res = await request(buildApp()).get('/protected').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  describe('ES256 / JWKS-signed tokens (newer Supabase projects)', () => {
    // Newer Supabase projects sign access tokens with an asymmetric key
    // (ES256) discoverable via /auth/v1/.well-known/jwks.json, not the
    // legacy shared "JWT secret" — jwt.verify(token, secret) can never
    // validate these regardless of which secret value is configured. This
    // was found by testing against a real deployed project, not by
    // inspection.
    let originalFetch: typeof fetch

    beforeEach(() => {
      originalFetch = global.fetch
      process.env.SUPABASE_URL = 'https://project.supabase.co'
    })

    afterEach(() => {
      global.fetch = originalFetch
    })

    it('allows a request with a valid ES256 token verified against the project JWKS endpoint', async () => {
      const { publicKey, privateKey } = await jose.generateKeyPair('ES256')
      const jwk = await jose.exportJWK(publicKey)
      jwk.kid = 'test-key-1'
      jwk.use = 'sig'
      jwk.alg = 'ES256'

      global.fetch = (async (url: string | URL) => {
        expect(String(url)).toBe('https://project.supabase.co/auth/v1/.well-known/jwks.json')
        return new Response(JSON.stringify({ keys: [jwk] }), {
          headers: { 'content-type': 'application/json' },
        })
      }) as typeof fetch

      const token = await new jose.SignJWT({ role: 'authenticated' })
        .setProtectedHeader({ alg: 'ES256', kid: 'test-key-1' })
        .setSubject('user-1')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey)

      const res = await request(buildApp()).get('/protected').set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ ok: true })
    })

    it('rejects an ES256 token that does not verify against the JWKS (wrong key)', async () => {
      const { publicKey } = await jose.generateKeyPair('ES256')
      const { privateKey: wrongPrivateKey } = await jose.generateKeyPair('ES256')
      const jwk = await jose.exportJWK(publicKey)
      jwk.kid = 'test-key-1'

      global.fetch = (async () =>
        new Response(JSON.stringify({ keys: [jwk] }), {
          headers: { 'content-type': 'application/json' },
        })) as typeof fetch

      const token = await new jose.SignJWT({ role: 'authenticated' })
        .setProtectedHeader({ alg: 'ES256', kid: 'test-key-1' })
        .setSubject('user-1')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(wrongPrivateKey)

      const res = await request(buildApp()).get('/protected').set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(401)
    })
  })
})
