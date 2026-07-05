import { describe, it, expect, vi, beforeEach } from 'vitest'
import { login, logout, getSession, getSessionRole } from '@/app/actions/auth'
import * as db from '@/lib/db'
import * as jwt from '@/lib/jwt'

// Must use vi.fn() without using outer variables in vi.mock factory
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn()
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/db', () => ({
  readJSON: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('@/lib/jwt', () => ({
  verifyToken: vi.fn(),
  signToken: vi.fn()
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn()
}))
vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn(), hash: vi.fn() }
}))

describe('Auth Actions', () => {
  let mockCookieStore: any
  let mockHeadersStore: any

  beforeEach(async () => {
    vi.resetAllMocks()
    mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: 'mock-token' }),
      set: vi.fn(),
      delete: vi.fn()
    }
    mockHeadersStore = {
      get: vi.fn().mockReturnValue('127.0.0.1')
    }
    const { cookies, headers } = await import('next/headers')
    vi.mocked(cookies).mockResolvedValue(mockCookieStore)
    vi.mocked(headers).mockResolvedValue(mockHeadersStore)
    
    vi.mocked(jwt.verifyToken).mockResolvedValue({ role: 'Admin', branchId: 'b1', name: 'admin' } as any)
    vi.mocked(jwt.signToken).mockResolvedValue('signed-token')

    const { checkRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkRateLimit).mockResolvedValue({ success: true } as any)
  })

  // ─── login ────────────────────────────────────────────────────────────────
  it('login fails rate limit', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkRateLimit).mockResolvedValue({ success: false, error: 'Too many login attempts, please try again in 5 minutes.' } as any)
    const fd = { get: () => null } as any
    const res = await login({}, fd)
    expect(res).toEqual({ error: 'Too many login attempts, please try again in 5 minutes.' })
  })

  it('login validates missing fields and weak passwords via Zod', async () => {
    const fd = { get: (k: string) => k === 'name' ? '' : 'weak' } as any
    const res = await login({}, fd)
    expect(res?.error).toBeDefined()
  })

  it('login returns error for invalid credentials', async () => {
    const bcrypt = (await import('bcryptjs')).default
    vi.mocked(bcrypt.compare).mockResolvedValue(false)
    vi.mocked(db.readJSON).mockResolvedValue([{ name: 'admin', password: '$2a$10$hash', role: 'Admin' }])
    const fd = { get: (k: string) => k === 'name' ? 'admin' : 'StrongPass1!' } as any
    const res = await login({}, fd)
    expect(res).toEqual({ error: 'Invalid Credentials' })
  })

  it('login succeeds and calls redirect', async () => {
    const bcrypt = (await import('bcryptjs')).default
    vi.mocked(bcrypt.compare).mockResolvedValue(true)
    const { redirect } = await import('next/navigation')
    vi.mocked(db.readJSON).mockResolvedValue([{ name: 'admin', password: '$2a$10$hash', role: 'Admin' }])
    const fd = { get: (k: string) => k === 'name' ? 'admin' : 'StrongPass1!' } as any
    await login({}, fd)
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('login handles db read failure gracefully', async () => {
    vi.mocked(db.readJSON).mockRejectedValue(new Error('DB error'))
    const fd = { get: (k: string) => k === 'name' ? 'admin' : 'StrongPass1!' } as any
    const res = await login({}, fd)
    expect(res).toEqual({ error: 'Invalid Credentials' })
  })

  // ─── logout ──────────────────────────────────────────────────────────────
  it('logout deletes session and redirects', async () => {
    const { redirect } = await import('next/navigation')
    await logout()
    expect(mockCookieStore.delete).toHaveBeenCalledWith('session')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  // ─── getSession ──────────────────────────────────────────────────────────
  it('getSession returns null when no cookie', async () => {
    mockCookieStore.get.mockReturnValue(null)
    const res = await getSession()
    expect(res).toBeNull()
  })

  it('getSession returns decoded session', async () => {
    const res = await getSession()
    expect(res).toHaveProperty('role', 'Admin')
  })

  // ─── getSessionRole ──────────────────────────────────────────────────────
  it('getSessionRole returns role string', async () => {
    const role = await getSessionRole()
    expect(role).toBe('Admin')
  })

  it('getSessionRole returns null when no session', async () => {
    mockCookieStore.get.mockReturnValue(null)
    const role = await getSessionRole()
    expect(role).toBeNull()
  })
})
