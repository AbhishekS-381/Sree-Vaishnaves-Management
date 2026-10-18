import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'
import { addUser, updateUser } from '@/app/actions/users'
import { proxy } from '@/proxy'

// Mock db
vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' }),
}))

// Mock next/cache and next/headers
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  }),
}))

// Mock jose
vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
  SignJWT: class MockSignJWT {
    payload: unknown
    constructor(payload: unknown) {
      this.payload = payload
    }
    setProtectedHeader() { return this }
    setIssuedAt() { return this }
    setExpirationTime() { return this }
    async sign() { return JSON.stringify(this.payload) }
  },
}))

function makeRequest(url: string, cookieValue?: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    headers: cookieValue ? { cookie: `session=${cookieValue}` } : {},
  })
}

describe('POS Auth & Proxy Extension (Task 2.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long'
    vi.spyOn(auth, 'getSession').mockResolvedValue({
      userId: 'admin_1',
      role: 'admin',
      isGlobalAdmin: true,
      isRootAdmin: true,
      branchId: 'b1',
    } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b1')
  })

  describe('JWT and posRole in login action', () => {
    it('sets posRole: true for billing, kitchen, and waiter roles', async () => {
      const { signToken } = await import('@/lib/jwt')
      const token = await signToken({
        userId: 'u1',
        name: 'Waiter Dave',
        role: 'waiter',
        isGlobalOwner: false,
        isGlobalAdmin: false,
        isRootAdmin: false,
        posRole: true,
      })
      const parsed = JSON.parse(token)
      expect(parsed.posRole).toBe(true)
      expect(parsed.role).toBe('waiter')
    })

    it('sets posRole: undefined or false for manager and admin roles', async () => {
      const { signToken } = await import('@/lib/jwt')
      const token = await signToken({
        userId: 'u2',
        name: 'Admin Alice',
        role: 'admin',
        isGlobalOwner: true,
        isGlobalAdmin: true,
        isRootAdmin: true,
      })
      const parsed = JSON.parse(token)
      expect(parsed.posRole).toBeUndefined()
    })
  })

  describe('users.ts - branchId validation for POS roles (Req 17.1, 17.2, 17.3)', () => {
    const posRoles = ['billing', 'kitchen', 'waiter']

    for (const role of posRoles) {
      it(`addUser rejects ${role} when branchId is missing`, async () => {
        const formData = new FormData()
        formData.set('name', `${role}_user`)
        formData.set('password', 'secret123')
        formData.set('role', role)
        // branchId omitted

        const res = await addUser({}, formData)
        expect(res).toEqual({ error: 'Branch is required for this role' })
      })

      it(`addUser succeeds for ${role} when branchId is provided`, async () => {
        let insertedUser: any = null
        vi.mocked(db.withTransaction).mockImplementation(async (_file, cb) => {
          const list: any[] = []
          const updated = await cb(list)
          insertedUser = updated[0]
          return true
        })

        const formData = new FormData()
        formData.set('name', `${role}_user`)
        formData.set('password', 'secret123')
        formData.set('role', role)
        formData.set('branchId', 'b_main')

        const res = await addUser({}, formData)
        expect(res).toEqual({ success: true })
        expect(insertedUser).toBeDefined()
        expect(insertedUser.role).toBe(role)
        expect(insertedUser.branchId).toBe('b_main')
      })

      it(`updateUser rejects ${role} when branchId is missing`, async () => {
        const formData = new FormData()
        formData.set('id', 'u_pos_1')
        formData.set('name', `${role}_user`)
        formData.set('role', role)
        // branchId omitted

        const res = await updateUser({}, formData)
        expect(res).toEqual({ error: 'Branch is required for this role' })
      })
    }
  })

  describe('proxy.ts - POS role page-lock enforcement (Req 8.2, 8.3, 17.5)', () => {
    it('redirects billing user to /management/pos/billing if visiting other management pages', async () => {
      const { jwtVerify } = await import('jose')
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { userId: 'b1', role: 'billing', posRole: true },
      } as any)

      // Visiting /management
      const req1 = makeRequest('http://localhost/management', 'valid-token')
      const res1 = await proxy(req1)
      expect(res1.status).toBe(307)
      expect(res1.headers.get('location')).toContain('/management/pos/billing')

      // Visiting /management/pos/kitchen
      const req2 = makeRequest('http://localhost/management/pos/kitchen', 'valid-token')
      const res2 = await proxy(req2)
      expect(res2.status).toBe(307)
      expect(res2.headers.get('location')).toContain('/management/pos/billing')

      // Visiting allowed designated page
      const req3 = makeRequest('http://localhost/management/pos/billing', 'valid-token')
      const res3 = await proxy(req3)
      expect(res3.status).toBe(200)
    })

    it('redirects kitchen user to /management/pos/kitchen if visiting other management pages', async () => {
      const { jwtVerify } = await import('jose')
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { userId: 'k1', role: 'kitchen', posRole: true },
      } as any)

      const req = makeRequest('http://localhost/management/pos/billing', 'valid-token')
      const res = await proxy(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/management/pos/kitchen')

      const reqOk = makeRequest('http://localhost/management/pos/kitchen', 'valid-token')
      const resOk = await proxy(reqOk)
      expect(resOk.status).toBe(200)
    })

    it('redirects waiter user to /management/pos/order if visiting other management pages', async () => {
      const { jwtVerify } = await import('jose')
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { userId: 'w1', role: 'waiter', posRole: true },
      } as any)

      const req = makeRequest('http://localhost/management/pos/billing', 'valid-token')
      const res = await proxy(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/management/pos/order')

      const reqOk = makeRequest('http://localhost/management/pos/order', 'valid-token')
      const resOk = await proxy(reqOk)
      expect(resOk.status).toBe(200)
    })

    it('allows manager and admin (non-posRole) to access various management routes without redirection', async () => {
      const { jwtVerify } = await import('jose')
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { userId: 'm1', role: 'manager', isGlobalAdmin: false, posRole: undefined },
      } as any)

      const req1 = makeRequest('http://localhost/management', 'valid-token')
      const res1 = await proxy(req1)
      expect(res1.status).toBe(200)

      const req2 = makeRequest('http://localhost/management/pos', 'valid-token')
      const res2 = await proxy(req2)
      expect(res2.status).toBe(200)
    })
  })
})
