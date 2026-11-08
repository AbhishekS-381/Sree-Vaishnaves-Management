import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as auth from '@/app/actions/auth'
import { updatePosGstRate } from '@/app/actions/config'
import { deleteUser } from '@/app/actions/users'
import { Navigation } from '@/components/Navigation'
import { proxy } from '@/proxy'
import { NextRequest } from 'next/server'

// Mock db
const { mockDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state: any = {
    config: [{ id: 'global', pos: true, posDefaultGstPercent: 5 }],
    users: [] as any[],
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    state,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: vi.fn(() => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      from: vi.fn((table: any) => {
        const isUsers = table?.tableName === 'users'
        const list = isUsers ? state.users : state.config
        let filtered = list
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const builder: any = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          where: vi.fn((cond: any) => {
            if (cond && isUsers) {
              const str = JSON.stringify(cond)
              filtered = list.filter((u: any) => str.includes(`"${u.id}"`))
            }
            return builder
          }),
          limit: vi.fn((count?: number) => {
            return Promise.resolve(count !== undefined ? filtered.slice(0, count) : filtered)
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          then: (res: any) => Promise.resolve(filtered).then(res),
        }
        return builder
      }),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insert: vi.fn(() => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      values: vi.fn((vals: any) => {
        Object.assign(state.config[0], vals)
        return {
          onConflictDoUpdate: vi.fn(() => {
            Object.assign(state.config[0], vals)
            return Promise.resolve([state.config[0]])
          }),
        }
      }),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: vi.fn((table: any) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set: vi.fn((vals: any) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: vi.fn((cond: any) => {
          const isUsers = table?.tableName === 'users'
          const list = isUsers ? state.users : state.config
          const str = JSON.stringify(cond)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          list.forEach((item: any) => {
            if (str.includes(`"${item.id}"`)) {
              Object.assign(item, vals)
            }
          })
          return Promise.resolve()
        }),
      })),
    })),
  }
  return { mockDb: mock }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  config: {
    tableName: 'config',
    id: { name: 'id' },
    posDefaultGstPercent: { name: 'pos_default_gst_percent' },
    pos: { name: 'pos' },
  },
  users: {
    tableName: 'users',
    id: { name: 'id' },
    role: { name: 'role' },
    isActive: { name: 'is_active' },
    deletedAt: { name: 'deleted_at' },
  },
  readJSON: vi.fn().mockImplementation(async () => mockDb.state.config),
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
    mockDb.state.config = [{ id: 'global', pos: true, posDefaultGstPercent: 5 }]
    mockDb.state.users = []

    vi.spyOn(auth, 'getSession').mockResolvedValue({
      userId: 'admin_1',
      role: 'admin',
      isGlobalAdmin: true,
      isRootAdmin: true,
      branchId: 'b_1',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  })

  // ─── 9.1 & 9.5 updatePosGstRate ────────────────────────────────────
  describe('updatePosGstRate action', () => {
    it('admin updates POS default GST rate successfully (0–28)', async () => {
      const fd = new FormData()
      fd.set('posDefaultGstPercent', '18')

      const res = await updatePosGstRate({}, fd)
      expect(res).toEqual({ success: true })
      expect(mockDb.state.config[0].posDefaultGstPercent).toBe(18)
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.getSession).mockResolvedValueOnce({
        role: 'manager',
        isGlobalAdmin: false,
        isRootAdmin: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { userId: 'u1', role: 'admin', isGlobalAdmin: true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      mockDb.state.config = [{ id: 'global', pos: false }]

      const req = makeRequest('http://localhost/management/pos/billing', 'valid-token')
      const res = await proxy(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toBe('http://localhost/management')
    })

    it('allows /management/pos access when config.pos is true', async () => {
      const { jwtVerify } = await import('jose')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(jwtVerify).mockResolvedValue({
        payload: { userId: 'u1', role: 'admin', isGlobalAdmin: true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      mockDb.state.config = [{ id: 'global', pos: true }]

      const req = makeRequest('http://localhost/management/pos', 'valid-token')
      const res = await proxy(req)
      expect(res.status).toBe(200)
    })
  })

  // ─── 9.7 User Deactivation for POS Roles ──────────────────────────
  describe('deleteUser for POS roles (Req 17.6)', () => {
    it('admin or owner can soft-delete a billing, kitchen, or waiter account', async () => {
      for (const role of ['billing', 'kitchen', 'waiter']) {
        mockDb.state.users = [
          { id: 'u_pos', name: 'pos_user', role, isActive: true },
        ]

        const res = await deleteUser('u_pos')
        expect(res).toEqual({ success: true })
        expect(mockDb.state.users[0].isActive).toBe(false)
        expect(mockDb.state.users[0].deletedAt).toBeDefined()
      }
    })

    it('manager is forbidden from soft-deleting POS accounts', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.getSession).mockResolvedValueOnce({
        role: 'manager',
        isGlobalAdmin: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const res = await deleteUser('u_pos')
      expect(res).toEqual({ error: 'Forbidden' })
    })
  })
})
