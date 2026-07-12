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
  writeJSON: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('@/lib/jwt', () => ({
  verifyToken: vi.fn(),
  signToken: vi.fn()
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  resetRateLimit: vi.fn(),
  pruneRateLimits: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn(), hash: vi.fn() }
}))

describe('Auth Actions', () => {
  let mockCookieStore: any
  let mockHeadersStore: any

  beforeEach(async () => {
    vi.clearAllMocks()
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
    
    vi.mocked(jwt.verifyToken).mockResolvedValue({ role: 'owner', branchId: 'b1', name: 'abhishek' } as any)
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
    vi.mocked(db.readJSON).mockResolvedValue([{ name: 'abhishek', password: '$2a$10$hash', role: 'owner' }])
    const fd = { get: (k: string) => k === 'name' ? 'abhishek' : 'StrongPass1!' } as any
    const res = await login({}, fd)
    expect(res).toEqual({ error: 'Invalid Credentials' })
  })

  it('login succeeds and calls redirect with valid hash', async () => {
    const bcrypt = (await import('bcryptjs')).default
    vi.mocked(bcrypt.compare).mockResolvedValue(true)
    const { redirect } = await import('next/navigation')
    vi.mocked(db.readJSON).mockResolvedValue([{ name: 'abhishek', password: '$2a$10$hash', role: 'owner' }])
    const fd = { get: (k: string) => k === 'name' ? 'abhishek' : 'StrongPass1!' } as any
    await login({}, fd)
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('login succeeds and calls redirect with plain password (fallback)', async () => {
    const { redirect } = await import('next/navigation')
    vi.mocked(db.readJSON).mockResolvedValue([{ name: 'test', password: 'plain', role: 'owner' }])
    const fd = { get: (k: string) => k === 'name' ? 'test' : 'plain' } as any
    await login({}, fd)
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('login triggers pruneRateLimits randomly', async () => {
    const { pruneRateLimits } = await import('@/lib/rate-limit')
    const originalRandom = Math.random
    Math.random = () => 0.005 // Trigger the < 0.01 condition
    
    const { redirect } = await import('next/navigation')
    vi.mocked(db.readJSON).mockResolvedValue([{ name: 'test', password: 'plain', role: 'owner' }])
    const fd = { get: (k: string) => k === 'name' ? 'test' : 'plain' } as any
    
    // Prevent redirect throwing
    vi.mocked(redirect).mockImplementation(() => {})
    
    await login({}, fd)
    expect(pruneRateLimits).toHaveBeenCalled()
    
    Math.random = originalRandom
  })

  it('login handles db read failure gracefully', async () => {
    vi.mocked(db.readJSON).mockRejectedValue(new Error('DB error'))
    const fd = { get: (k: string) => k === 'name' ? 'abhishek' : 'StrongPass1!' } as any
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
    expect(res).toHaveProperty('role', 'owner')
  })

  // ─── getSessionRole ──────────────────────────────────────────────────────
  it('getSessionRole returns role string', async () => {
    vi.mocked(jwt.verifyToken).mockResolvedValueOnce({ role: 'owner' } as any)
    const role = await getSessionRole()
    expect(role).toBe('owner')
  })

  it('getSessionRole returns null when no session', async () => {
    mockCookieStore.get.mockReturnValue(null)
    const role = await getSessionRole()
    expect(role).toBeNull()
  })

  // ─── requireBranchAccess ──────────────────────────────────────────────────
  it('requireBranchAccess throws if no session', async () => {
    const { requireBranchAccess } = await import('@/app/actions/auth')
    mockCookieStore.get.mockReturnValue(null)
    await expect(requireBranchAccess('b1')).rejects.toThrow('Unauthorized')
  })

  it('requireBranchAccess returns requested branch if global admin', async () => {
    const { requireBranchAccess } = await import('@/app/actions/auth')
    vi.mocked(jwt.verifyToken).mockResolvedValueOnce({ role: 'owner', isGlobalAdmin: true, branchId: 'b1' } as any)
    const res = await requireBranchAccess('b2')
    expect(res).toBe('b2')
  })

  it('requireBranchAccess returns user branch if standard user and requested branch is empty', async () => {
    const { requireBranchAccess } = await import('@/app/actions/auth')
    vi.mocked(jwt.verifyToken).mockResolvedValueOnce({ role: 'staff', isGlobalAdmin: false, branchId: 'b1' } as any)
    const res = await requireBranchAccess('')
    expect(res).toBe('b1')
  })

  it('requireBranchAccess throws if standard user requests different branch', async () => {
    const { requireBranchAccess } = await import('@/app/actions/auth')
    vi.mocked(jwt.verifyToken).mockResolvedValueOnce({ role: 'staff', isGlobalAdmin: false, branchId: 'b1' } as any)
    await expect(requireBranchAccess('b2')).rejects.toThrow('Forbidden: You can only access your assigned branch.')
  })

  // ─── migratePasswordsToHash ───────────────────────────────────────────────
  it('migratePasswordsToHash returns Forbidden if not admin', async () => {
    const { migratePasswordsToHash } = await import('@/app/actions/auth')
    mockCookieStore.get.mockReturnValue({ value: 'mock' })
    vi.mocked(jwt.verifyToken).mockResolvedValueOnce({ role: 'owner' } as any)
    const res = await migratePasswordsToHash()
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('migratePasswordsToHash skips migration if no users need it', async () => {
    const { migratePasswordsToHash } = await import('@/app/actions/auth')
    mockCookieStore.get.mockReturnValue({ value: 'mock' })
    vi.mocked(jwt.verifyToken).mockResolvedValueOnce({ role: 'admin' } as any)
    vi.mocked(db.readJSON).mockResolvedValue([{ name: 'test', password: '$2a$10$hash' }])
    const res = await migratePasswordsToHash()
    expect(res).toEqual({ success: true, message: 'No passwords needed migration' })
  })

  it('migratePasswordsToHash migrates passwords', async () => {
    const { migratePasswordsToHash } = await import('@/app/actions/auth')
    const bcrypt = (await import('bcryptjs')).default
    mockCookieStore.get.mockReturnValue({ value: 'mock' })
    vi.mocked(jwt.verifyToken).mockResolvedValue({ role: 'admin' } as any)
    vi.mocked(db.readJSON).mockResolvedValue([{ name: 'test', password: 'plain' }])
    vi.mocked(bcrypt.hash).mockResolvedValue('$2a$10$newhash' as never)
    const res = await migratePasswordsToHash()
    expect(res).toEqual({ success: true, message: 'Passwords migrated successfully' })
    expect(db.writeJSON).toHaveBeenCalled()
  })
})
