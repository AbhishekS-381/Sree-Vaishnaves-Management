import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

// Mock jose jwtVerify since we run in jsdom / node
vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}))

const { mockDb } = vi.hoisted(() => {
  const state = {
    configRows: [{ pos: true }] as any[],
    shouldThrow: false,
  }
  const mock: any = {
    state,
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            if (state.shouldThrow) throw new Error('DB read error')
            return state.configRows
          }),
        })),
      })),
    })),
  }
  return { mockDb: mock }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  config: { tableName: 'config', id: { name: 'id' } },
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
    mockDb.state.configRows = [{ pos: true }]
    mockDb.state.shouldThrow = false
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

  it.each([
    ['http://localhost/kitchen', '/management/pos/kitchen'],
    ['http://localhost/kitchen/', '/management/pos/kitchen'],
    ['http://localhost/kitchen/1', '/management/pos/kitchen/1'],
    ['http://localhost/order', '/management/pos/order'],
    ['http://localhost/order/', '/management/pos/order'],
    ['http://localhost/order/table-1', '/management/pos/order/table-1'],
    ['http://localhost/billing', '/management/pos/billing'],
    ['http://localhost/billing/', '/management/pos/billing'],
    ['http://localhost/billing/2', '/management/pos/billing/2'],
    ['http://localhost/pos', '/management/pos'],
    ['http://localhost/pos/', '/management/pos'],
    ['http://localhost/pos/sub', '/management/pos/sub'],
  ])('redirects friendly short alias %s to %s', async (fromUrl, toPath) => {
    const req = makeRequest(fromUrl)
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`http://localhost${toPath}`)
  })

  it('redirects to /management/login when visiting /management without session', async () => {
    const req = makeRequest('http://localhost/management')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management/login')
  })

  it('redirects to /management/login when visiting /management/branches without session', async () => {
    const req = makeRequest('http://localhost/management/branches')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management/login')
  })

  it('redirects to /management/login when session token is invalid', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockRejectedValue(new Error('Invalid token'))

    const req = makeRequest('http://localhost/management', 'invalid-token')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management/login')
  })

  it('allows access to /management/login when not logged in', async () => {
    const req = makeRequest('http://localhost/management/login')
    const res = await proxy(req)
    expect(res.status).toBe(200)
  })

  it('redirects to /management when logged-in user visits /management/login', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'admin' } } as any)

    const req = makeRequest('http://localhost/management/login', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management')
  })

  it('allows logged-in user access to /management and attaches no-cache headers', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'admin' } } as any)

    const req = makeRequest('http://localhost/management', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate')
    expect(res.headers.get('Pragma')).toBe('no-cache')
  })

  it('allows logged-in user access to /management/staff', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'manager' } } as any)

    const req = makeRequest('http://localhost/management/staff', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(200)
  })

  it('redirects posRole user visiting /management/login to designated POS home (billing)', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { posRole: true, role: 'billing' } } as any)

    const req = makeRequest('http://localhost/management/login', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management/pos/billing')
  })

  it('redirects posRole user visiting /management/login to designated POS home (kitchen)', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { posRole: true, role: 'kitchen' } } as any)

    const req = makeRequest('http://localhost/management/login', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management/pos/kitchen')
  })

  it('redirects posRole user visiting /management/login to designated POS home (waiter)', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { posRole: true, role: 'waiter' } } as any)

    const req = makeRequest('http://localhost/management/login', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management/pos/order')
  })

  it('redirects to /management for unknown posRole on /management/login', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { posRole: true, role: 'unknown' } } as any)

    const req = makeRequest('http://localhost/management/login', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/management')
  })

  // ── POS Module Route Pass-Through (Guard enforced by Page Server Components) ──
  it('allows /management/pos/* requests through to page guard for authenticated users', async () => {
    const { jwtVerify } = await import('jose')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'admin' } } as any)

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
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { posRole: true, role } } as any)

    const req = makeRequest(`http://localhost${path}`, 'valid-token')
    const res = await proxy(req)

    if (isAllowed) {
      expect(res.status).toBe(200)
    } else {
      expect(res.status).toBe(307)
      const location = res.headers.get('location') || ''
      expect(location).toContain(
        role === 'waiter' ? '/management/pos/order' :
        role === 'kitchen' ? '/management/pos/kitchen' :
        '/management/pos/billing'
      )
    }
  })

  it('passes through when non-posRole user accesses any /management/pos/* page', async () => {
    const { jwtVerify } = await import('jose')
    vi.mocked(jwtVerify).mockResolvedValue({ payload: { role: 'manager', isGlobalAdmin: false } } as any)

    const req = makeRequest('http://localhost/management/pos/kitchen', 'valid-token')
    const res = await proxy(req)
    expect(res.status).toBe(200)
  })
})
