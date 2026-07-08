import { describe, it, expect, vi } from 'vitest'
import * as jose from 'jose'

process.env.JWT_SECRET = 'test-secret'

// Mock jose — SignJWT must be a real class (constructor function)
vi.mock('jose', async () => {
  function MockSignJWT(this: any) {
    this.setProtectedHeader = () => this
    this.setIssuedAt = () => this
    this.setExpirationTime = () => this
    this.sign = async () => 'mocked.jwt.token'
  }
  return {
    SignJWT: MockSignJWT,
    jwtVerify: vi.fn().mockResolvedValue({
      payload: { userId: 'u1', name: 'Alice', role: 'owner', isGlobalOwner: true }
    })
  }
})

describe('jwt.ts', () => {
  it('signToken returns a token string', async () => {
    const { signToken } = await import('@/lib/jwt')
    const token = await signToken({ userId: 'u1', name: 'Alice', role: 'owner', isGlobalOwner: true } as any)
    expect(typeof token).toBe('string')
    expect(token).toBe('mocked.jwt.token')
  })

  it('verifyToken returns decoded payload for a valid token', async () => {
    const { verifyToken } = await import('@/lib/jwt')
    const payload = await verifyToken('mocked.jwt.token')
    expect(payload).toMatchObject({ userId: 'u1', role: 'owner', name: 'Alice' })
  })

  it('verifyToken returns null when jwtVerify throws', async () => {
    vi.mocked(jose.jwtVerify).mockRejectedValueOnce(new Error('bad signature'))
    const { verifyToken } = await import('@/lib/jwt')
    const result = await verifyToken('invalid.token')
    expect(result).toBeNull()
  })
})
