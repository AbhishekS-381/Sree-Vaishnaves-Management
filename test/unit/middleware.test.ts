import { describe, it, expect, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '@/middleware'

// Mock jose jwtVerify since we run in jsdom
vi.mock('jose', () => ({
  jwtVerify: vi.fn()
}))

function makeRequest(url: string, cookieValue?: string): NextRequest {
  const req = new NextRequest(new URL(url, 'http://localhost'), {
    headers: cookieValue ? { cookie: `session=${cookieValue}` } : {}
  })
  return req
}

describe('middleware.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret'
  })

  it('redirects logged-in user away from /management/login', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'owner', isGlobalOwner: true } } as any)
    const req = makeRequest('http://localhost/management/login', 'valid-token')
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management')
  })

  it('allows non-logged-in user to access /management/login', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockRejectedValue(new Error('invalid'))
    const req = makeRequest('http://localhost/management/login')
    const res = await middleware(req)
    expect(res.status).toBe(200) // next()
  })

  it('redirects unauthenticated access to protected route', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockRejectedValue(new Error('Invalid token'))
    
    const req = makeRequest('http://localhost/management/dashboard')
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management/login')
  })

  it('allows authenticated access to protected route', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'owner', isGlobalOwner: true } } as any)
    const req = makeRequest('http://localhost/management/dashboard', 'valid-token')
    const res = await middleware(req)
    expect(res.status).toBe(200) // next()
  })

  it('handles missing cookie gracefully (no token)', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockRejectedValue(new Error('Should not be called'))
    
    // Simulate Request with no session cookie
    const req = makeRequest('http://localhost/management/staff')
    const res = await middleware(req)
    expect(res.status).toBe(307) // redirect to /management/login
  })

  it('throws an error if JWT_SECRET is not set', async () => {
    const originalSecret = process.env.JWT_SECRET
    delete process.env.JWT_SECRET

    const req = makeRequest('http://localhost/management/dashboard', 'valid-token')
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management/login')
    process.env.JWT_SECRET = originalSecret
  })
})
