import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

// Mock jose jwtVerify since we run in jsdom / node
vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  readJSON: vi.fn(),
  DB_FILES: {
    CONFIG: 'config.json',
  },
}))

function makeRequest(url: string, cookieValue?: string): NextRequest {
  const req = new NextRequest(new URL(url, 'http://localhost'), {
    headers: cookieValue ? { cookie: `session=${cookieValue}` } : {},
  })
  return req
}

describe('proxy.ts (route protection)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret'
    const { readJSON } = await import('@/lib/db')
    vi.mocked(readJSON).mockResolvedValue([{ pos: true }] as any)
  })

  it('allows public access to /', async () => {
    const req = makeRequest('http://localhost/')
    const res = await proxy(req)
    expect(res.status).toBe(200) // next()
  })

  it('allows public access to non-management routes', async () => {
    const req = makeRequest('http://localhost/some-api-route')
    const res = await proxy(req)
    expect(res.status).toBe(200) // next()
  })

  it('redirects logged-in user away from /management/login', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'owner', isGlobalOwner: true } } as any)
    const req = makeRequest('http://localhost/management/login', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management')
  })

  it('allows non-logged-in user to access /management/login', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockRejectedValue(new Error('invalid'))
    const req = makeRequest('http://localhost/management/login')
    const res = await proxy(req)
    expect(res.status).toBe(200) // next()
  })

  it('redirects unauthenticated access to protected route', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockRejectedValue(new Error('Invalid token'))

    const req = makeRequest('http://localhost/management/dashboard', 'invalid-token')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management/login')
  })

  it('allows authenticated access to protected route and sets no-cache headers', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'owner', isGlobalOwner: true } } as any)
    const req = makeRequest('http://localhost/management/dashboard', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(200) // next()
    expect(res.headers.get('Cache-Control')).toContain('no-store')
    expect(res.headers.get('Pragma')).toBe('no-cache')
  })

  it('handles missing cookie gracefully (no token)', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockRejectedValue(new Error('Should not be called'))

    // Simulate Request with no session cookie
    const req = makeRequest('http://localhost/management/staff')
    const res = await proxy(req)
    expect(res.status).toBe(307) // redirect to /management/login
  })

  it('throws an error if JWT_SECRET is not set', async () => {
    const originalSecret = process.env.JWT_SECRET
    delete process.env.JWT_SECRET

    const req = makeRequest('http://localhost/management/dashboard', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management/login')
    process.env.JWT_SECRET = originalSecret
  })

  // ── POS Role Login Redirects ──
  it.each([
    ['billing', '/management/pos/billing'],
    ['kitchen', '/management/pos/kitchen'],
    ['waiter', '/management/pos/order'],
  ])('redirects posRole user (%s) from /management/login to designated home (%s)', async (role, expectedHome) => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role, posRole: true } } as any)

    const req = makeRequest('http://localhost/management/login', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain(expectedHome)
  })

  it('redirects posRole user with unknown role from /management/login to /management fallback', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'unknown_role', posRole: true } } as any)

    const req = makeRequest('http://localhost/management/login', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management')
  })

  it('falls back to /management redirect if inner jwtVerify fails at /management/login', async () => {
    const { jwtVerify } = await import('jose')
    // First call succeeds for session validation, second call throws
    vi.mocked(jwtVerify)
      .mockResolvedValueOnce({ payload: {} } as any)
      .mockRejectedValueOnce(new Error('verify error'))

    const req = makeRequest('http://localhost/management/login', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management')
  })

  // ── POS Module Enabled Check ──
  it('redirects away from /management/pos/* if pos is disabled in config', async () => {
    const { jwtVerify } = await import('jose')
    const { readJSON } = await import('@/lib/db')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'admin' } } as any)
    vi.mocked(readJSON).mockResolvedValue([{ pos: false }] as any)

    const req = makeRequest('http://localhost/management/pos/billing', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management')
  })

  it('redirects away from /management/pos/* if config is empty list', async () => {
    const { jwtVerify } = await import('jose')
    const { readJSON } = await import('@/lib/db')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'admin' } } as any)
    vi.mocked(readJSON).mockResolvedValue([] as any)

    const req = makeRequest('http://localhost/management/pos/kitchen', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management')
  })

  it('fails open if readJSON throws when checking POS enabled', async () => {
    const { jwtVerify } = await import('jose')
    const { readJSON } = await import('@/lib/db')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'admin' } } as any)
    vi.mocked(readJSON).mockRejectedValue(new Error('DB read error'))

    const req = makeRequest('http://localhost/management/pos/billing', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(200)
  })

  // ── POS Role Dedicated Home Enforcement ──
  it.each([
    ['waiter', '/management/pos/order', true],
    ['waiter', '/management/pos/billing', false],
    ['kitchen', '/management/pos/kitchen', true],
    ['kitchen', '/management/pos/billing', false],
    ['billing', '/management/pos/billing', true],
    ['billing', '/management/pos/order', false],
  ])('enforces designated home for %s accessing %s (allowed: %s)', async (role, path, isAllowed) => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role, posRole: true } } as any)

    const req = makeRequest(`http://localhost${path}`, 'valid-token')
    const res = await proxy(req)

    if (isAllowed) {
      expect(res.status).toBe(200)
    } else {
      expect(res.status).toBe(307)
    }
  })

  it('allows access to protected route when posRole is true but role has no designated home', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'unknown_role', posRole: true } } as any)

    const req = makeRequest('http://localhost/management/dashboard', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(200)
  })

  it('ignores inner edge-case re-verify failure on protected route and proceeds', async () => {
    const { jwtVerify } = await import('jose')
    // First call succeeds for isValidSession, second call fails
    vi.mocked(jwtVerify)
      .mockResolvedValueOnce({ payload: {} } as any)
      .mockRejectedValueOnce(new Error('edge-case verify error'))

    const req = makeRequest('http://localhost/management/dashboard', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(200)
  })
})
