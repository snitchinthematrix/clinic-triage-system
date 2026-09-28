import { describe, it, expect, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { asyncHandler } from './asyncHandler'

describe('asyncHandler', () => {
  it('forwards a rejected promise to next(err) instead of leaving it unhandled', async () => {
    const app = express()
    app.get(
      '/boom',
      asyncHandler(async () => {
        throw new Error('unexpected bug')
      })
    )
    // Express 4's default error handler responds 500 once next(err) is called.
    const res = await request(app).get('/boom')
    expect(res.status).toBe(500)
  })

  it('does not interfere with a handler that succeeds', async () => {
    const app = express()
    app.get(
      '/ok',
      asyncHandler(async (_req, res) => {
        res.json({ ok: true })
      })
    )
    const res = await request(app).get('/ok')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})
