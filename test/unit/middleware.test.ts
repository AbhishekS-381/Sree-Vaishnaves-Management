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
    vi.resetAllMocks()
  })

  it('redirects logged-in user away from /login', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'Admin' } } as any)
    const req = makeRequest('http://localhost/login', 'valid-token')
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/')
  })

  it('allows non-logged-in user to access /login', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockRejectedValue(new Error('invalid'))
    const req = makeRequest('http://localhost/login')
    const res = await middleware(req)
    expect(res.status).toBe(200) // next()
  })

  it('redirects unauthenticated access to protected route', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockRejectedValue(new Error('invalid'))
    const req = makeRequest('http://localhost/dashboard')
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('allows authenticated access to protected route', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'Admin' } } as any)
    const req = makeRequest('http://localhost/dashboard', 'valid-token')
    const res = await middleware(req)
    expect(res.status).toBe(200) // next()
  })

  it('handles missing cookie gracefully (no token)', async () => {
    const req = makeRequest('http://localhost/staff')
    const res = await middleware(req)
    expect(res.status).toBe(307) // redirect to /login
  })
})
