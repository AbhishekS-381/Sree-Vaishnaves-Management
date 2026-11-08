import { describe, it, expect, vi, beforeEach } from 'vitest'
import KitchenBranchPage from '@/app/management/pos/kitchen/[branchId]/page'
import WaiterOrderBranchPage from '@/app/management/pos/order/[branchId]/page'
import BillingBranchPage from '@/app/management/pos/billing/[branchId]/page'
import PosDashboardBranchPage from '@/app/management/pos/[branchId]/page'

const { mockRedirect, mockGetSession, mockGetKitchenKots, mockGetTodayPosData, mockDb } = vi.hoisted(() => {
  const branches = [
    { id: 'br_alpha', name: 'Alpha Branch', isActive: true },
    { id: 'br_beta', name: 'Beta Branch', isActive: true },
  ]
  const config = [{ pos: true }]

  const mock: any = {
    select: vi.fn((_fields?: any) => ({
      from: vi.fn((table: any) => {
        const tableName = table?.tableName || ''
        let data: any[] = []
        if (tableName === 'branches') data = branches
        else if (tableName === 'config') data = config

        const builder: any = {
          where: vi.fn(() => builder),
          orderBy: vi.fn(() => builder),
          limit: vi.fn((count?: number) => Promise.resolve(count !== undefined ? data.slice(0, count) : data)),
          catch: (cb: any) => Promise.resolve(data).catch(cb),
          then: (res: any, rej: any) => Promise.resolve(data).then(res, rej),
        }
        return builder
      }),
    })),
  }

  return {
    mockRedirect: vi.fn(),
    mockGetSession: vi.fn(),
    mockGetKitchenKots: vi.fn(),
    mockGetTodayPosData: vi.fn(),
    mockDb: mock,
  }
})

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

vi.mock('@/app/actions/auth', () => ({
  getSession: mockGetSession,
}))

vi.mock('@/lib/db', () => ({
  db: mockDb,
  config: { tableName: 'config', id: { name: 'id' } },
  branches: { tableName: 'branches', id: { name: 'id' }, name: { name: 'name' }, isActive: { name: 'is_active' }, deletedAt: { name: 'deleted_at' } },
  posTables: { tableName: 'pos_tables', id: { name: 'id' }, branchId: { name: 'branch_id' }, deletedAt: { name: 'deleted_at' } },
  posOrders: { tableName: 'pos_orders', id: { name: 'id' }, branchId: { name: 'branch_id' }, date: { name: 'date' }, status: { name: 'status' } },
  posKots: { tableName: 'pos_kots', id: { name: 'id' }, branchId: { name: 'branch_id' }, orderId: { name: 'order_id' }, status: { name: 'status' } },
  menuCategories: { tableName: 'menu_categories', id: { name: 'id' }, name: { name: 'name' }, deletedAt: { name: 'deleted_at' } },
  users: { tableName: 'users', id: { name: 'id' }, name: { name: 'name' }, role: { name: 'role' }, isActive: { name: 'is_active' } },
}))

vi.mock('@/app/actions/pos', () => ({
  getKitchenKots: mockGetKitchenKots,
  getTodayPosData: mockGetTodayPosData,
}))

describe('Dynamic POS Branch Routes ([branchId])', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetKitchenKots.mockResolvedValue({ kots: [] })
    mockGetTodayPosData.mockResolvedValue({
      tables: [],
      orders: [],
      kots: [],
      catalog: [],
      todayIST: '2026-10-20',
    })
  })

  describe('KitchenBranchPage (/management/pos/kitchen/[branchId])', () => {
    it('resolves branchId "1" to first branch (Alpha Branch) and renders KitchenClientPage', async () => {
      mockGetSession.mockResolvedValue({
        userId: 'u_admin',
        name: 'Admin',
        role: 'admin',
        isGlobalAdmin: true,
      })

      const element = await KitchenBranchPage({
        params: Promise.resolve({ branchId: '1' }),
      })

      expect(element).toBeDefined()
      expect(element.props.branchId).toBe('br_alpha')
      expect(mockGetKitchenKots).toHaveBeenCalledWith('br_alpha')
    })

    it('resolves branchId "2" to second branch (Beta Branch)', async () => {
      mockGetSession.mockResolvedValue({
        userId: 'u_admin',
        name: 'Admin',
        role: 'admin',
        isGlobalAdmin: true,
      })

      const element = await KitchenBranchPage({
        params: Promise.resolve({ branchId: '2' }),
      })

      expect(element).toBeDefined()
      expect(element.props.branchId).toBe('br_beta')
      expect(mockGetKitchenKots).toHaveBeenCalledWith('br_beta')
    })

    it('resolves exact branch ID string "br_beta"', async () => {
      mockGetSession.mockResolvedValue({
        userId: 'u_admin',
        name: 'Admin',
        role: 'admin',
        isGlobalAdmin: true,
      })

      const element = await KitchenBranchPage({
        params: Promise.resolve({ branchId: 'br_beta' }),
      })

      expect(element.props.branchId).toBe('br_beta')
    })

    it('redirects to login when unauthenticated', async () => {
      mockGetSession.mockResolvedValue(null)

      await KitchenBranchPage({
        params: Promise.resolve({ branchId: '1' }),
      })

      expect(mockRedirect).toHaveBeenCalledWith('/management/login')
    })
  })

  describe('WaiterOrderBranchPage (/management/pos/order/[branchId])', () => {
    it('resolves branchId "1" to first branch and loads today POS data for br_alpha', async () => {
      mockGetSession.mockResolvedValue({
        userId: 'u_admin',
        name: 'Admin',
        role: 'admin',
        isGlobalAdmin: true,
      })

      const element = await WaiterOrderBranchPage({
        params: Promise.resolve({ branchId: '1' }),
      })

      expect(element).toBeDefined()
      expect(element.props.activeBranchId).toBe('br_alpha')
      expect(mockGetTodayPosData).toHaveBeenCalledWith('br_alpha')
    })
  })

  describe('BillingBranchPage (/management/pos/billing/[branchId])', () => {
    it('resolves branchId "1" to first branch and provides activeBranchId to BillingClientPage', async () => {
      mockGetSession.mockResolvedValue({
        userId: 'u_admin',
        name: 'Admin',
        role: 'admin',
        isGlobalAdmin: true,
      })

      const element = await BillingBranchPage({
        params: Promise.resolve({ branchId: '1' }),
      })

      expect(element).toBeDefined()
      expect(element.props.activeBranchId).toBe('br_alpha')
    })
  })

  describe('PosDashboardBranchPage (/management/pos/[branchId])', () => {
    it('resolves branchId "2" to Beta Branch and loads main POS client page', async () => {
      mockGetSession.mockResolvedValue({
        userId: 'u_admin',
        name: 'Admin',
        role: 'admin',
        isGlobalAdmin: true,
      })

      const element = await PosDashboardBranchPage({
        params: Promise.resolve({ branchId: '2' }),
      })

      expect(element).toBeDefined()
      expect(element.props.activeBranchId).toBe('br_beta')
      expect(mockGetTodayPosData).toHaveBeenCalledWith('br_beta')
    })
  })
})
