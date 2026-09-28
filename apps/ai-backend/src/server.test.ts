import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from './server'

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})

describe('CORS', () => {
  it('allows cross-origin requests from the configured frontend origin', async () => {
    const res = await request(app)
      .options('/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
    expect(res.headers['access-control-allow-origin']).toBeDefined()
  })
})
