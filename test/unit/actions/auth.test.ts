import { describe, it, expect, vi, beforeEach } from 'vitest'
import { login, logout, getSession, getSessionRole } from '@/app/actions/auth'
import * as db from '@/lib/db'
import * as jwt from '@/lib/jwt'

// Must use vi.fn() without using outer variables in vi.mock factory
vi.mock('next/headers', () => ({
  cookies: vi.fn()
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

describe('Auth Actions', () => {
  let mockCookieStore: any

  beforeEach(async () => {
    vi.resetAllMocks()
    mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: 'mock-token' }),
      set: vi.fn(),
      delete: vi.fn()
    }
    const { cookies } = await import('next/headers')
    vi.mocked(cookies).mockResolvedValue(mockCookieStore)
    vi.mocked(jwt.verifyToken).mockResolvedValue({ role: 'Admin', branchId: 'b1', name: 'admin' } as any)
    vi.mocked(jwt.signToken).mockResolvedValue('signed-token')
  })

  // ─── login ────────────────────────────────────────────────────────────────
  it('login validates missing fields', async () => {
    const fd = { get: () => null } as any
    const res = await login({}, fd)
    expect(res).toEqual({ error: 'Username and Password required' })
  })

  it('login returns error for invalid credentials', async () => {
    vi.mocked(db.readJSON).mockResolvedValue([{ name: 'admin', password: 'correct', role: 'Admin' }])
    const fd = { get: (k: string) => k === 'name' ? 'admin' : 'wrong' } as any
    const res = await login({}, fd)
    expect(res).toEqual({ error: 'Invalid Credentials' })
  })

  it('login succeeds and calls redirect', async () => {
    const { redirect } = await import('next/navigation')
    vi.mocked(db.readJSON).mockResolvedValue([{ name: 'admin', password: 'pass', role: 'Admin' }])
    const fd = { get: (k: string) => k === 'name' ? 'admin' : 'pass' } as any
    await login({}, fd)
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('login handles db read failure gracefully', async () => {
    vi.mocked(db.readJSON).mockRejectedValue(new Error('DB error'))
    const fd = { get: (k: string) => k === 'name' ? 'admin' : 'pass' } as any
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
