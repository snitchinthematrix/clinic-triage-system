import jwt from 'jsonwebtoken'

// Test-only helper: signs a token with the same SUPABASE_JWT_SECRET the
// test environment sets (vitest.config.mjs), so route tests can exercise
// requireAuth-protected endpoints without a real Supabase project.
export function testBearerToken(): string {
  const secret = process.env.SUPABASE_JWT_SECRET ?? 'test-jwt-secret'
  return `Bearer ${jwt.sign({ sub: 'test-user' }, secret)}`
}
