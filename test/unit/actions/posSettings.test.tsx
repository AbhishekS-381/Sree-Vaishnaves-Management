import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'
import { updatePosGstRate } from '@/app/actions/config'
import { deleteUser } from '@/app/actions/users'
import { Navigation } from '@/components/Navigation'
import { proxy } from '@/proxy'
import { NextRequest } from 'next/server'

// Mock db
vi.mock('@/lib/db', () => ({
  readJSON: vi.fn(),
  writeJSON: vi.fn().mockResolvedValue(true),
  withTransaction: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' }),
}))

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/management',
  useRouter: () => ({ refresh: vi.fn() }),
}))

// Mock jose
vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}))

function makeRequest(url: string, cookieValue?: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    headers: cookieValue ? { cookie: `session=${cookieValue}` } : {},
  })
}

describe('POS Settings, Navigation Guards, and User Management (Tasks 9.1–9.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long'
    vi.spyOn(auth, 'getSession').mockResolvedValue({
      userId: 'admin_1',
      role: 'admin',
      isGlobalAdmin: true,
      isRootAdmin: true,
      branchId: 'b_1',
    } as any)
  })

  // ─── 9.1 & 9.5 updatePosGstRate ────────────────────────────────────
  describe('updatePosGstRate action', () => {
    it('admin updates POS default GST rate successfully (0–28)', async () => {
      let savedConfig: any[] = []
      vi.mocked(db.readJSON).mockResolvedValueOnce([
        { id: 'global', pos: true, posDefaultGstPercent: 5 },
      ])
      vi.mocked(db.writeJSON).mockImplementation(async (_file, data) => {
        savedConfig = data
        return true
      })

      const fd = new FormData()
      fd.set('posDefaultGstPercent', '18')

      const res = await updatePosGstRate({}, fd)
      expect(res).toEqual({ success: true })
      expect(savedConfig[0].posDefaultGstPercent).toBe(18)
    })

    it('rejects invalid GST rates (-1, 29, NaN)', async () => {
      // -1 (below min 0)
      const fdNegative = new FormData()
      fdNegative.set('posDefaultGstPercent', '-1')
      const resNegative = await updatePosGstRate({}, fdNegative)
      expect(resNegative).toEqual({ error: 'Invalid GST rate. Must be an integer between 0 and 28.' })

      // 29 (above max 28)
      const fdHigh = new FormData()
      fdHigh.set('posDefaultGstPercent', '29')
      const resHigh = await updatePosGstRate({}, fdHigh)
      expect(resHigh).toEqual({ error: 'Invalid GST rate. Must be an integer between 0 and 28.' })
    })

    it('rejects non-admin users from updating GST rate', async () => {
      vi.mocked(auth.getSession).mockResolvedValueOnce({
        role: 'manager',
        isGlobalAdmin: false,
        isRootAdmin: false,
      } as any)

      const fd = new FormData()
      fd.set('posDefaultGstPercent', '5')
      const res = await updatePosGstRate({}, fd)
      expect(res).toEqual({ error: 'Forbidden' })
    })
  })

  // ─── 9.2 & 9.5 Navigation Render Guards ────────────────────────────
  describe('Navigation POS render guard', () => {
    it('renders POS link when config.pos is true and user is manager/admin', () => {
      render(
        <Navigation
          role="manager"
          config={{ pos: true }}
          isGlobalOwner={false}
          isRootAdmin={false}
        />
      )
      expect(screen.queryByText('POS')).not.toBeNull()
    })

    it('hides POS link when config.pos is false', () => {
      render(
        <Navigation
          role="manager"
          config={{ pos: false }}
          isGlobalOwner={false}
          isRootAdmin={false}
        />
      )
      expect(screen.queryByText('POS')).toBeNull()
    })

    it('hides POS link when role is readonly', () => {
      render(
        <Navigation
          role="readonly"
          config={{ pos: true }}
          isGlobalOwner={false}
          isRootAdmin={false}
        />
      )
      expect(screen.queryByText('POS')).toBeNull()
    })

    it('hides POS link when role is billing, kitchen, or waiter', () => {
      for (const role of ['billing', 'kitchen', 'waiter']) {
        const { unmount } = render(
          <Navigation
            role={role}
            config={{ pos: true }}
            isGlobalOwner={false}
            isRootAdmin={false}
          />
        )
        expect(screen.queryByText('POS')).toBeNull()
        unmount()
      }
    })
  })

  // ─── 9.6 Proxy POS Module Toggle Guard ────────────────────────────
  describe('proxy.ts - POS disabled redirect (Req 9.2)', () => {
    it('redirects /management/pos/* to /management when config.pos is false', async () => {
      const { jwtVerify } = await import('jose')
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { userId: 'u1', role: 'admin', isGlobalAdmin: true },
      } as any)

      vi.mocked(db.readJSON).mockResolvedValue([{ id: 'global', pos: false }])

      const req = makeRequest('http://localhost/management/pos/billing', 'valid-token')
      const res = await proxy(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toBe('http://localhost/management')
    })

    it('allows /management/pos access when config.pos is true', async () => {
      const { jwtVerify } = await import('jose')
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { userId: 'u1', role: 'admin', isGlobalAdmin: true },
      } as any)

      vi.mocked(db.readJSON).mockResolvedValue([{ id: 'global', pos: true }])

      const req = makeRequest('http://localhost/management/pos', 'valid-token')
      const res = await proxy(req)
      expect(res.status).toBe(200)
    })
  })

  // ─── 9.7 User Deactivation for POS Roles ──────────────────────────
  describe('deleteUser for POS roles (Req 17.6)', () => {
    it('admin or owner can soft-delete a billing, kitchen, or waiter account', async () => {
      for (const role of ['billing', 'kitchen', 'waiter']) {
        let updatedList: any[] = []
        vi.mocked(db.withTransaction).mockImplementation(async (_file, cb) => {
          const list = [
            { id: 'u_pos', name: 'pos_user', role, isActive: true },
          ]
          updatedList = await cb(list)
          return true
        })

        const res = await deleteUser('u_pos')
        expect(res).toEqual({ success: true })
        expect(updatedList[0].isActive).toBe(false)
        expect(updatedList[0].deletedAt).toBeDefined()
      }
    })

    it('manager is forbidden from soft-deleting POS accounts', async () => {
      vi.mocked(auth.getSession).mockResolvedValueOnce({
        role: 'manager',
        isGlobalAdmin: false,
      } as any)

      const res = await deleteUser('u_pos')
      expect(res).toEqual({ error: 'Forbidden' })
    })
  })
})
