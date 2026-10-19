import { describe, it, expect, vi, beforeEach } from 'vitest'
import PosDashboardPage from '@/app/management/pos/page'
import WaiterOrderPage from '@/app/management/pos/order/page'
import BillingPage from '@/app/management/pos/billing/page'
import KitchenPage from '@/app/management/pos/kitchen/page'
import PosHistoryPage from '@/app/management/pos/history/page'
import { DB_FILES } from '@/lib/db'

// Mocks
const { authMocks, navMocks, dbMocks, posActionMocks } = vi.hoisted(() => ({
  authMocks: {
    getSession: vi.fn(),
  },
  navMocks: {
    redirect: vi.fn(),
  },
  dbMocks: {
    readJSON: vi.fn(),
  },
  posActionMocks: {
    getTodayPosData: vi.fn(),
    getKitchenKots: vi.fn(),
  },
}))

vi.mock('@/app/actions/auth', () => ({
  getSession: authMocks.getSession,
}))

vi.mock('next/navigation', () => ({
  redirect: navMocks.redirect,
}))

vi.mock('@/lib/db', () => ({
  readJSON: dbMocks.readJSON,
  DB_FILES: {
    CONFIG: 'config.json',
    BRANCHES: 'branches.json',
    POS_TABLES: 'pos_tables.json',
    POS_ORDERS: 'pos_orders.json',
    POS_KOTS: 'pos_kots.json',
    USERS: 'users.json',
  },
}))

vi.mock('@/app/actions/pos', () => ({
  getTodayPosData: posActionMocks.getTodayPosData,
  getKitchenKots: posActionMocks.getKitchenKots,
}))

// Mock client components
vi.mock('@/app/management/pos/PosClientPage', () => ({
  default: () => null,
}))

vi.mock('@/app/management/pos/order/WaiterOrderClientPage', () => ({
  default: () => null,
}))

vi.mock('@/app/management/pos/billing/BillingClientPage', () => ({
  default: () => null,
}))

vi.mock('@/app/management/pos/kitchen/KitchenClientPage', () => ({
  default: () => null,
}))

vi.mock('@/app/management/pos/history/PosHistoryClientPage', () => ({
  default: () => null,
}))

describe('POS Server Pages - posServerPages.test.tsx', () => {
  const sampleBranches = [
    { id: 'br-1', name: 'Main Branch', isActive: true },
    { id: 'br-2', name: 'Airport Branch', isActive: true },
    { id: 'br-inactive', name: 'Closed Branch', isActive: false },
  ]

  const sampleConfig = [{ pos: true, posDefaultGstPercent: 5 }]

  const sampleTables = [
    { id: 'tbl-1', branchId: 'br-1', name: 'Table 1', capacity: 4, isActive: true },
    { id: 'tbl-2', branchId: 'br-1', name: 'Table 2', capacity: 2, isActive: true },
  ]

  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  const sampleOrders = [
    {
      id: 'ord-today-1',
      branchId: 'br-1',
      tableId: 'tbl-1',
      status: 'open',
      date: todayIST,
      items: [],
    },
    {
      id: 'ord-stale-1',
      branchId: 'br-1',
      tableId: 'tbl-2',
      status: 'open',
      date: '2026-01-01',
      items: [],
    },
    {
      id: 'ord-stale-tkw',
      branchId: 'br-1',
      orderType: 'takeaway',
      takeawayNumber: 'T-99',
      status: 'open',
      date: '2026-01-01',
      items: [],
    },
    {
      id: 'ord-other-branch',
      branchId: 'br-2',
      tableId: 'tbl-x',
      status: 'open',
      date: '2026-01-01',
      items: [],
    },
    {
      id: 'ord-billed-1',
      branchId: 'br-1',
      status: 'billed',
      date: todayIST,
      bill: { generatedAt: '2026-10-19T10:00:00Z', totalPayable: 200 },
      items: [],
    },
    {
      id: 'ord-paid-1',
      branchId: 'br-1',
      status: 'paid',
      date: todayIST,
      payment: { paidAt: '2026-10-19T10:15:00Z', method: 'cash' },
      items: [],
    },
  ]

  const sampleKots = [
    {
      id: 'kot-1',
      branchId: 'br-1',
      orderId: 'ord-today-1',
      kotNumber: 1,
      status: 'served',
      updatedAt: '2026-10-19T10:30:00Z',
      firedAt: '2026-10-19T10:05:00Z',
      items: [{ menuItemId: 'm1', nameSnapshot: 'Paneer Masala', quantity: 2, note: 'Spicy' }],
    },
  ]

  const sampleUsers = [
    { id: 'usr-1', name: 'Abhishek Admin' },
    { id: 'usr-2', name: 'Ravi Cashier' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Default db responses
    dbMocks.readJSON.mockImplementation(async (file: string) => {
      if (file === DB_FILES.CONFIG) return sampleConfig
      if (file === DB_FILES.BRANCHES) return sampleBranches
      if (file === DB_FILES.POS_TABLES) return sampleTables
      if (file === DB_FILES.POS_ORDERS) return sampleOrders
      if (file === DB_FILES.POS_KOTS) return sampleKots
      if (file === DB_FILES.USERS) return sampleUsers
      return []
    })

    posActionMocks.getTodayPosData.mockResolvedValue({
      tables: sampleTables,
      orders: sampleOrders,
      kots: sampleKots,
      catalog: [],
      todayIST: '2026-10-19',
    })

    posActionMocks.getKitchenKots.mockResolvedValue({
      kots: [{ id: 'kot-active-1', status: 'pending', items: [] }],
    })

    // Next.js redirect throws to halt execution in server components
    navMocks.redirect.mockImplementation((url: string) => {
      const err = new Error(`NEXT_REDIRECT: ${url}`)
      ;(err as any).digest = `NEXT_REDIRECT;replace;${url};307;;`
      throw err
    })
  })

  // =========================================================================
  // 1. PosDashboardPage (/management/pos/page.tsx)
  // =========================================================================
  describe('PosDashboardPage', () => {
    it('redirects unauthenticated user to /management/login', async () => {
      authMocks.getSession.mockResolvedValue(null)
      await expect(PosDashboardPage({})).rejects.toThrow('NEXT_REDIRECT: /management/login')
    })

    it('redirects user with posRole waiter to /management/pos/order', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'waiter', posRole: 'waiter', branchId: 'br-1' })
      await expect(PosDashboardPage({})).rejects.toThrow('NEXT_REDIRECT: /management/pos/order')
    })

    it('redirects user with posRole kitchen to /management/pos/kitchen', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'kitchen', posRole: 'kitchen', branchId: 'br-1' })
      await expect(PosDashboardPage({})).rejects.toThrow('NEXT_REDIRECT: /management/pos/kitchen')
    })

    it('redirects user with posRole billing to /management/pos/billing', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'billing', posRole: 'billing', branchId: 'br-1' })
      await expect(PosDashboardPage({})).rejects.toThrow('NEXT_REDIRECT: /management/pos/billing')
    })

    it('redirects posRole user with unknown role to /management', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'custom_pos', posRole: 'custom', branchId: 'br-1' })
      await expect(PosDashboardPage({})).rejects.toThrow('NEXT_REDIRECT: /management')
    })

    it('redirects non-manager, non-owner, non-admin to /management', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'staff', branchId: 'br-1' })
      await expect(PosDashboardPage({})).rejects.toThrow('NEXT_REDIRECT: /management')
    })

    it('redirects to /management if pos is disabled in config', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'admin', isGlobalAdmin: true })
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.CONFIG) return [{ pos: false }]
        return []
      })
      await expect(PosDashboardPage({})).rejects.toThrow('NEXT_REDIRECT: /management')
    })

    it('redirects to /management if config list is empty', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'admin', isGlobalAdmin: true })
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.CONFIG) return []
        return []
      })
      await expect(PosDashboardPage({})).rejects.toThrow('NEXT_REDIRECT: /management')
    })

    it('scopes branches to user branch for non-global admin', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'manager', branchId: 'br-2', isGlobalAdmin: false })
      const res = await PosDashboardPage({})

      expect(res.props.branches).toHaveLength(1)
      expect(res.props.branches[0].id).toBe('br-2')
      expect(res.props.activeBranchId).toBe('br-2')
    })

    it('allows global admin to view active branches (excludes inactive branches)', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'admin', isGlobalAdmin: true })
      const res = await PosDashboardPage({})

      expect(res.props.branches).toHaveLength(2)
      expect(res.props.branches.map((b: any) => b.id)).toEqual(['br-1', 'br-2'])
      expect(res.props.activeBranchId).toBe('br-1')
    })

    it('honors requested branch param for global admin when branch exists', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'admin', isGlobalAdmin: true })
      const searchParams = Promise.resolve({ branch: 'br-2' })
      const res = await PosDashboardPage({ searchParams })

      expect(res.props.activeBranchId).toBe('br-2')
    })

    it('ignores invalid branch param for global admin and falls back to first branch', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'admin', isGlobalAdmin: true })
      const searchParams = Promise.resolve({ branch: 'br-nonexistent' })
      const res = await PosDashboardPage({ searchParams })

      expect(res.props.activeBranchId).toBe('br-1')
    })

    it('redirects to /management if no active branch can be determined', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'admin', isGlobalAdmin: true })
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.CONFIG) return sampleConfig
        if (file === DB_FILES.BRANCHES) return [] // No branches
        return []
      })
      await expect(PosDashboardPage({})).rejects.toThrow('NEXT_REDIRECT: /management')
    })

    it('fetches today pos data and identifies stale open orders with table or takeaway labels', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'admin', isGlobalAdmin: true })
      const res = await PosDashboardPage({})

      expect(res.props.initialData).toBeDefined()
      expect(res.props.initialData.tables).toHaveLength(2)
      expect(res.props.staleOrders).toHaveLength(2)

      const tblStale = res.props.staleOrders.find((o: any) => o.id === 'ord-stale-1')
      expect(tblStale.tableName).toBe('Table 2')

      const tkwStale = res.props.staleOrders.find((o: any) => o.id === 'ord-stale-tkw')
      expect(tkwStale.tableName).toBe('T-99')
    })

    it('passes initialData as null if getTodayPosData returns error', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'admin', isGlobalAdmin: true })
      posActionMocks.getTodayPosData.mockResolvedValue({ error: 'DB_READ_FAILURE' })

      const res = await PosDashboardPage({})
      expect(res.props.initialData).toBeNull()
    })

    it('passes posDefaultGstPercent from config to PosClientPage', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'admin', isGlobalAdmin: true })
      const res = await PosDashboardPage({})
      expect(res.props.posDefaultGstPercent).toBe(5)
    })
  })

  // =========================================================================
  // 2. WaiterOrderPage (/management/pos/order/page.tsx)
  // =========================================================================
  describe('WaiterOrderPage', () => {
    it('redirects unauthenticated user to /management/login', async () => {
      authMocks.getSession.mockResolvedValue(null)
      await expect(WaiterOrderPage({})).rejects.toThrow('NEXT_REDIRECT: /management/login')
    })

    it('allows waiter role to access waiter order page', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'waiter', branchId: 'br-1' })
      const res = await WaiterOrderPage({})
      expect(res.type).toBeDefined()
      expect(res.props.activeBranchId).toBe('br-1')
    })

    it('allows manager, owner, admin to access waiter order page', async () => {
      for (const role of ['manager', 'owner', 'admin']) {
        authMocks.getSession.mockResolvedValue({ role, branchId: 'br-1' })
        const res = await WaiterOrderPage({})
        expect(res.type).toBeDefined()
      }
    })

    it('redirects kitchen role to /management', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'kitchen', branchId: 'br-1' })
      await expect(WaiterOrderPage({})).rejects.toThrow('NEXT_REDIRECT: /management')
    })

    it('redirects billing role to /management', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'billing', branchId: 'br-1' })
      await expect(WaiterOrderPage({})).rejects.toThrow('NEXT_REDIRECT: /management')
    })

    it('redirects read-only or unauthorized role to /management', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'read_only', branchId: 'br-1' })
      await expect(WaiterOrderPage({})).rejects.toThrow('NEXT_REDIRECT: /management')
    })

    it('redirects to /management if pos config is disabled', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'waiter', branchId: 'br-1' })
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.CONFIG) return [{ pos: false }]
        return []
      })
      await expect(WaiterOrderPage({})).rejects.toThrow('NEXT_REDIRECT: /management')
    })

    it('redirects to /management if getTodayPosData returns error', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'waiter', branchId: 'br-1' })
      posActionMocks.getTodayPosData.mockResolvedValue({ error: 'FAILED_TO_LOAD' })
      await expect(WaiterOrderPage({})).rejects.toThrow('NEXT_REDIRECT: /management')
    })

    it('properly populates initialData and staleOrders for waiter view', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'waiter', branchId: 'br-1' })
      const res = await WaiterOrderPage({})

      expect(res.props.activeBranchId).toBe('br-1')
      expect(res.props.initialData.tables).toHaveLength(2)
      expect(res.props.staleOrders.length).toBeGreaterThanOrEqual(1)
    })
  })

  // =========================================================================
  // 3. BillingPage (/management/pos/billing/page.tsx)
  // =========================================================================
  describe('BillingPage', () => {
    it('redirects unauthenticated user to /management/login', async () => {
      authMocks.getSession.mockResolvedValue(null)
      await expect(BillingPage({})).rejects.toThrow('NEXT_REDIRECT: /management/login')
    })

    it('allows billing role to access billing page', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'billing', branchId: 'br-1' })
      const res = await BillingPage({})
      expect(res.type).toBeDefined()
      expect(res.props.activeBranchId).toBe('br-1')
    })

    it('allows manager, owner, admin to access billing page', async () => {
      for (const role of ['manager', 'owner', 'admin']) {
        authMocks.getSession.mockResolvedValue({ role, branchId: 'br-1' })
        const res = await BillingPage({})
        expect(res.type).toBeDefined()
      }
    })

    it('redirects waiter and kitchen roles to /management', async () => {
      for (const role of ['waiter', 'kitchen']) {
        authMocks.getSession.mockResolvedValue({ role, branchId: 'br-1' })
        await expect(BillingPage({})).rejects.toThrow('NEXT_REDIRECT: /management')
      }
    })

    it('redirects to /management if pos config is disabled', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'billing', branchId: 'br-1' })
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.CONFIG) return [{ pos: false }]
        return []
      })
      await expect(BillingPage({})).rejects.toThrow('NEXT_REDIRECT: /management')
    })

    it('sorts billed orders and paid orders correctly and builds tableMap', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'billing', branchId: 'br-1' })
      const res = await BillingPage({})

      expect(res.props.billedOrders).toHaveLength(1)
      expect(res.props.billedOrders[0].id).toBe('ord-billed-1')
      expect(res.props.paidOrders).toHaveLength(1)
      expect(res.props.paidOrders[0].id).toBe('ord-paid-1')
      expect(res.props.openOrders).toHaveLength(1)
      expect(res.props.openOrders[0].id).toBe('ord-today-1')
      expect(res.props.tableMap['tbl-1']).toBe('Table 1')
      expect(res.props.posDefaultGstPercent).toBe(5)
    })
  })

  // =========================================================================
  // 4. KitchenPage (/management/pos/kitchen/page.tsx)
  // =========================================================================
  describe('KitchenPage', () => {
    it('redirects unauthenticated user to /management/login', async () => {
      authMocks.getSession.mockResolvedValue(null)
      await expect(KitchenPage({})).rejects.toThrow('NEXT_REDIRECT: /management/login')
    })

    it('allows kitchen role to access kitchen display page', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'kitchen', branchId: 'br-1' })
      const res = await KitchenPage({})
      expect(res.type).toBeDefined()
      expect(res.props.branchId).toBe('br-1')
    })

    it('allows manager, owner, admin to access kitchen display page', async () => {
      for (const role of ['manager', 'owner', 'admin']) {
        authMocks.getSession.mockResolvedValue({ role, branchId: 'br-1' })
        const res = await KitchenPage({})
        expect(res.type).toBeDefined()
      }
    })

    it('redirects waiter and billing roles to /management', async () => {
      for (const role of ['waiter', 'billing']) {
        authMocks.getSession.mockResolvedValue({ role, branchId: 'br-1' })
        await expect(KitchenPage({})).rejects.toThrow('NEXT_REDIRECT: /management')
      }
    })

    it('redirects to /management if pos config is disabled', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'kitchen', branchId: 'br-1' })
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.CONFIG) return [{ pos: false }]
        return []
      })
      await expect(KitchenPage({})).rejects.toThrow('NEXT_REDIRECT: /management')
    })

    it('loads active KOTs from getKitchenKots and serves list of served KOTs', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'kitchen', branchId: 'br-1' })
      const res = await KitchenPage({})

      expect(res.props.initialActiveKots).toHaveLength(1)
      expect(res.props.initialActiveKots[0].id).toBe('kot-active-1')
      expect(res.props.initialServedKots).toHaveLength(1)
      expect(res.props.initialServedKots[0].id).toBe('kot-1')
      expect(res.props.initialServedKots[0].orderIdentifier).toBe('Table 1')
    })

    it('handles empty active kots safely', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'kitchen', branchId: 'br-1' })
      posActionMocks.getKitchenKots.mockResolvedValue({ error: 'FAILED_TO_LOAD' })

      const res = await KitchenPage({})
      expect(res.props.initialActiveKots).toEqual([])
    })
  })

  // =========================================================================
  // 5. PosHistoryPage (/management/pos/history/page.tsx)
  // =========================================================================
  describe('PosHistoryPage', () => {
    it('redirects unauthenticated user to /management/login', async () => {
      authMocks.getSession.mockResolvedValue(null)
      await expect(PosHistoryPage()).rejects.toThrow('NEXT_REDIRECT: /management/login')
    })

    it('allows admin and owner roles to access history', async () => {
      for (const role of ['admin', 'owner']) {
        authMocks.getSession.mockResolvedValue({ role, branchId: 'br-1', isGlobalAdmin: false })
        const res = await PosHistoryPage()
        expect(res.type).toBeDefined()
      }
    })

    it('allows global admin with manager role to access history', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'manager', isGlobalAdmin: true })
      const res = await PosHistoryPage()
      expect(res.type).toBeDefined()
    })

    it('redirects non-global-admin manager to /management', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'manager', isGlobalAdmin: false })
      await expect(PosHistoryPage()).rejects.toThrow('NEXT_REDIRECT: /management')
    })

    it('redirects waiter, kitchen, billing to /management', async () => {
      for (const role of ['waiter', 'kitchen', 'billing']) {
        authMocks.getSession.mockResolvedValue({ role, isGlobalAdmin: false })
        await expect(PosHistoryPage()).rejects.toThrow('NEXT_REDIRECT: /management')
      }
    })

    it('constructs branches, tableMap and userMap from database', async () => {
      authMocks.getSession.mockResolvedValue({ role: 'admin', isGlobalAdmin: true })
      const res = await PosHistoryPage()

      expect(res.props.branches).toHaveLength(2) // Only active
      expect(res.props.tableMap['tbl-1']).toBe('Table 1')
      expect(res.props.tableMap['tbl-2']).toBe('Table 2')
      expect(res.props.userMap['usr-1']).toBe('Abhishek Admin')
      expect(res.props.userMap['usr-2']).toBe('Ravi Cashier')
    })
  })
})
