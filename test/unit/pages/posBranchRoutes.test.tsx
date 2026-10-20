import { describe, it, expect, vi, beforeEach } from 'vitest'
import KitchenBranchPage from '@/app/management/pos/kitchen/[branchId]/page'
import WaiterOrderBranchPage from '@/app/management/pos/order/[branchId]/page'
import BillingBranchPage from '@/app/management/pos/billing/[branchId]/page'
import PosDashboardBranchPage from '@/app/management/pos/[branchId]/page'

const { mockRedirect, mockGetSession, mockReadJSON, mockGetKitchenKots, mockGetTodayPosData } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockGetSession: vi.fn(),
  mockReadJSON: vi.fn(),
  mockGetKitchenKots: vi.fn(),
  mockGetTodayPosData: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

vi.mock('@/app/actions/auth', () => ({
  getSession: mockGetSession,
}))

vi.mock('@/lib/db', () => ({
  readJSON: mockReadJSON,
  DB_FILES: {
    BRANCHES: 'branches.json',
    CONFIG: 'config.json',
    POS_ORDERS: 'pos_orders.json',
    POS_KOTS: 'pos_kots.json',
    POS_TABLES: 'pos_tables.json',
  },
}))

vi.mock('@/app/actions/pos', () => ({
  getKitchenKots: mockGetKitchenKots,
  getTodayPosData: mockGetTodayPosData,
}))

describe('Dynamic POS Branch Routes ([branchId])', () => {
  const branches = [
    { id: 'br_alpha', name: 'Alpha Branch', isActive: true },
    { id: 'br_beta', name: 'Beta Branch', isActive: true },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockReadJSON.mockImplementation(async (file: string) => {
      if (file === 'branches.json') return branches
      if (file === 'config.json') return [{ pos: true }]
      if (file === 'pos_orders.json') return []
      if (file === 'pos_kots.json') return []
      if (file === 'pos_tables.json') return []
      return []
    })
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
