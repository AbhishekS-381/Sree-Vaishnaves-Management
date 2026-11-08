import { describe, it, expect, vi, beforeEach } from 'vitest'
import { login, logout, getSession, getSessionRole } from '@/app/actions/auth'
import * as jwt from '@/lib/jwt'

const { mockDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryBuilder: any = {
    where: vi.fn(),
    limit: vi.fn(),
  }
  queryBuilder.where.mockReturnValue(queryBuilder)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateBuilder: any = {
    set: vi.fn(),
    where: vi.fn().mockResolvedValue([]),
  }
  updateBuilder.set.mockReturnValue(updateBuilder)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    _fromResult: [],
    _limitResult: [],
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnValue(queryBuilder),
    update: vi.fn().mockReturnValue(updateBuilder),
    _queryBuilder: queryBuilder,
    _updateBuilder: updateBuilder,
  }

  queryBuilder.then = (resolve: any, reject: any) =>
    Promise.resolve(mock._fromResult).then(resolve, reject)
  queryBuilder.catch = (fn: any) =>
    Promise.resolve(mock._fromResult).catch(fn)
  queryBuilder.limit.mockImplementation(() => Promise.resolve(mock._limitResult))

  return { mockDb: mock }
})

// Must use vi.fn() without using outer variables in vi.mock factory
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn()
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: mockDb,
  users: {
    id: 'id',
    name: 'name',
    password: 'password',
    role: 'role',
    branchId: 'branchId',
    isActive: 'isActive',
  },
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
    mockDb._fromResult = []
    mockDb._limitResult = []
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnValue(mockDb._queryBuilder)
    mockDb._queryBuilder.where.mockReturnValue(mockDb._queryBuilder)
    mockDb._queryBuilder.limit.mockImplementation(() => Promise.resolve(mockDb._limitResult))
    mockDb.update.mockReturnValue(mockDb._updateBuilder)
    mockDb._updateBuilder.set.mockReturnValue(mockDb._updateBuilder)
    mockDb._updateBuilder.where.mockResolvedValue([])

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
    vi.mocked(bcrypt.compare as any).mockResolvedValue(false)
    mockDb._limitResult = [{ name: 'abhishek', password: '$2a$10$hash', role: 'owner' }]
    const fd = { get: (k: string) => k === 'name' ? 'abhishek' : 'StrongPass1!' } as any
    const res = await login({}, fd)
    expect(res).toEqual({ error: 'Invalid Credentials' })
  })

  it('login succeeds and calls redirect with valid hash', async () => {
    const bcrypt = (await import('bcryptjs')).default
    vi.mocked(bcrypt.compare as any).mockResolvedValue(true)
    const { redirect } = await import('next/navigation')
    mockDb._limitResult = [{ name: 'abhishek', password: '$2a$10$hash', role: 'owner' }]
    const fd = { get: (k: string) => k === 'name' ? 'abhishek' : 'StrongPass123' } as any
    await login({}, fd)
    expect(redirect).toHaveBeenCalledWith('/management')
  })

  it('login fails with plain password (fallback removed)', async () => {
    const bcrypt = (await import('bcryptjs')).default
    vi.mocked(bcrypt.compare as any).mockResolvedValue(false)
    mockDb._limitResult = [{ name: 'test', password: 'plain', role: 'owner' }]
    const fd = { get: (k: string) => k === 'name' ? 'test' : 'plain' } as any
    const res = await login({}, fd)
    expect(res).toEqual({ error: 'Invalid Credentials' })
  })

  it('login triggers pruneRateLimits randomly', async () => {
    const { pruneRateLimits } = await import('@/lib/rate-limit')
    const originalRandom = Math.random
    Math.random = () => 0.005 // Trigger the < 0.01 condition
    
    const bcrypt = (await import('bcryptjs')).default
    vi.mocked(bcrypt.compare as any).mockResolvedValue(true)
    const { redirect } = await import('next/navigation')
    mockDb._limitResult = [{ name: 'test', password: '$2a$10$hash', role: 'owner' }]
    const fd = { get: (k: string) => k === 'name' ? 'test' : 'password' } as any
    
    // Prevent redirect throwing
    vi.mocked(redirect as any).mockImplementation(() => {})
    
    await login({}, fd)
    expect(pruneRateLimits).toHaveBeenCalled()
    
    Math.random = originalRandom
  })

  it('login handles db read failure gracefully', async () => {
    mockDb._queryBuilder.limit.mockRejectedValueOnce(new Error('DB error'))
    const fd = { get: (k: string) => k === 'name' ? 'abhishek' : 'StrongPass1!' } as any
    const res = await login({}, fd)
    expect(res).toEqual({ error: 'Invalid Credentials' })
  })

  // ─── logout ──────────────────────────────────────────────────────────────
  it('logout deletes session and redirects', async () => {
    const { cookies } = await import('next/headers')
    const { redirect } = await import('next/navigation')
    const mockCookieStore = { delete: vi.fn() }
    vi.mocked(cookies).mockReturnValue(mockCookieStore as any)
    await logout()
    expect(mockCookieStore.delete).toHaveBeenCalledWith('session')
    expect(redirect).toHaveBeenCalledWith('/management/login')
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
    mockDb._fromResult = [{ id: 'u1', name: 'test', password: '$2a$10$hash' }]
    const res = await migratePasswordsToHash()
    expect(res).toEqual({ success: true, message: 'No passwords needed migration' })
  })

  it('migratePasswordsToHash migrates passwords', async () => {
    const { migratePasswordsToHash } = await import('@/app/actions/auth')
    const bcrypt = (await import('bcryptjs')).default
    mockCookieStore.get.mockReturnValue({ value: 'mock' })
    vi.mocked(jwt.verifyToken).mockResolvedValue({ role: 'admin' } as any)
    mockDb._fromResult = [{ id: 'u1', name: 'test', password: 'plain' }]
    vi.mocked(bcrypt.hash).mockResolvedValue('$2a$10$newhash' as never)
    const res = await migratePasswordsToHash()
    expect(res).toEqual({ success: true, message: 'Passwords migrated successfully' })
    expect(mockDb.update).toHaveBeenCalled()
  })
})
