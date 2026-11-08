import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as auth from '@/app/actions/auth'
import * as audit from '@/lib/audit'
import {
  getKitchenKots,
  getPosOrderHistory,
  getDailySummary,
  getPosDataForEOD,
} from '@/app/actions/pos'
import type { PosOrder, PosKot, PosTable } from '@/app/actions/posTypes'

const { mockDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state: any = {
    tables: [] as any[],
    orders: [] as any[],
    kots: [] as any[],
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCollection = (tableName?: string): any[] => {
    if (tableName === 'pos_tables') return state.tables
    if (tableName === 'pos_orders') return state.orders
    if (tableName === 'pos_kots') return state.kots
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filterItem = (tableName: string, item: any, str: string): boolean => {
    if (tableName === 'pos_orders') {
      if (str.includes('"2026-10-14"') && str.includes('"2026-10-15"')) {
        return item.date >= '2026-10-14' && item.date <= '2026-10-15'
      }
      if (str.includes('"2026-10-15"') && item.date !== '2026-10-15') return false
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      if (str.includes(`"${today}"`) && item.date !== today) return false
      return true
    }
    if (tableName === 'pos_kots') {
      if (str.includes('"pending"') && !['pending', 'preparing', 'ready'].includes(item.status)) return false
      return true
    }
    return true
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    state,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: vi.fn((_fields?: any) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      from: vi.fn((table: any) => {
        const tableName = table?.tableName || ''
        const collection = getCollection(tableName)
        let filtered = collection

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const builder: any = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          where: vi.fn((cond?: any) => {
            if (cond) {
              const str = JSON.stringify(cond)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              filtered = collection.filter((item: any) => filterItem(tableName, item, str))
            }
            return builder
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          orderBy: vi.fn((_col: any) => {
            if (tableName === 'pos_kots') {
              filtered = [...filtered].sort((a: any, b: any) => (a.firedAt || '').localeCompare(b.firedAt || ''))
            }
            return builder
          }),
          limit: vi.fn((count?: number) => {
            return Promise.resolve(count !== undefined ? filtered.slice(0, count) : filtered)
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          then: (resolve: any) => Promise.resolve(filtered).then(resolve),
        }
        return builder
      }),
    })),
  }

  return { mockDb: mock }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  withDbTransaction: vi.fn(),
  posTables: {
    tableName: 'pos_tables',
    id: { name: 'id' },
    name: { name: 'name' },
    branchId: { name: 'branch_id' },
  },
  posOrders: {
    tableName: 'pos_orders',
    id: { name: 'id' },
    tableId: { name: 'table_id' },
    takeawayNumber: { name: 'takeaway_number' },
    orderType: { name: 'order_type' },
    branchId: { name: 'branch_id' },
    date: { name: 'date' },
  },
  posKots: {
    tableName: 'pos_kots',
    id: { name: 'id' },
    branchId: { name: 'branch_id' },
    orderId: { name: 'order_id' },
    status: { name: 'status' },
    firedAt: { name: 'fired_at' },
  },
}))

vi.mock('@/lib/audit', () => ({
  logAction: vi.fn().mockResolvedValue(true),
}))

describe('POS Read Actions & Audit Guarantees (Tasks 7.1–7.5, Req 12.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.state.tables = []
    mockDb.state.orders = []
    mockDb.state.kots = []

    vi.spyOn(auth, 'getSession').mockResolvedValue({
      userId: 'u_admin',
      role: 'admin',
      isGlobalAdmin: true,
      branchId: 'b_1',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b_1')
  })

  // ─── 7.1 getKitchenKots ───────────────────────────────────────────
  describe('getKitchenKots', () => {
    it('returns active KOTs in FIFO order with identifiers and strips financial data', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.getSession).mockResolvedValue({
        userId: 'u_chef',
        role: 'kitchen',
        isGlobalAdmin: false,
        branchId: 'b_1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

      const orders: PosOrder[] = [
        { id: 'o1', branchId: 'b_1', tableId: 't1', date: today, orderType: 'dine-in', status: 'open', items: [], kotCount: 1, openedBy: 'u1', createdAt: '', updatedAt: '' },
        { id: 'o2', branchId: 'b_1', takeawayNumber: 'T-1', date: today, orderType: 'takeaway', status: 'open', items: [], kotCount: 1, openedBy: 'u1', createdAt: '', updatedAt: '' },
      ]

      const tables: PosTable[] = [
        { id: 't1', branchId: 'b_1', name: 'Table 4', isActive: true, createdAt: '', updatedAt: '' },
      ]

      const kots: PosKot[] = [
        // Later KOT
        { id: 'k2', branchId: 'b_1', orderId: 'o2', kotNumber: 1, items: [{ menuItemId: 'm2', nameSnapshot: 'Vada', quantity: 1 }], status: 'pending', firedBy: 'u1', firedAt: '2026-10-15T12:05:00Z', updatedAt: '' },
        // Earlier KOT
        { id: 'k1', branchId: 'b_1', orderId: 'o1', kotNumber: 1, items: [{ menuItemId: 'm1', nameSnapshot: 'Idli', quantity: 2 }], status: 'preparing', firedBy: 'u1', firedAt: '2026-10-15T12:00:00Z', updatedAt: '' },
        // Served KOT — must be excluded from active kitchen list
        { id: 'k_served', branchId: 'b_1', orderId: 'o1', kotNumber: 2, items: [], status: 'served', firedBy: 'u1', firedAt: '2026-10-15T12:01:00Z', updatedAt: '' },
      ]

      mockDb.state.orders = orders
      mockDb.state.tables = tables
      mockDb.state.kots = kots

      const res = await getKitchenKots('b_1')
      expect('error' in res).toBe(false)
      if ('error' in res) return

      expect(res.kots.length).toBe(2)
      // FIFO sorted: k1 (12:00) before k2 (12:05)
      expect(res.kots[0].id).toBe('k1')
      expect(res.kots[0].orderIdentifier).toBe('Table 4')
      expect(res.kots[1].id).toBe('k2')
      expect(res.kots[1].orderIdentifier).toBe('T-1')

      // Check financial data stripped (items have NO unitPrice or amount)
      for (const kot of res.kots) {
        for (const item of kot.items) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          expect((item as any).unitPrice).toBeUndefined()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          expect((item as any).price).toBeUndefined()
        }
      }

      // Read-only actions must NOT write audit logs (Req 12.3)
      expect(audit.logAction).not.toHaveBeenCalled()
    })
  })

  // ─── 7.2 getPosOrderHistory ───────────────────────────────────────
  describe('getPosOrderHistory', () => {
    it('returns orders in date range and summary aggregates for admin', async () => {
      const orders: PosOrder[] = [
        {
          id: 'o1',
          branchId: 'b_1',
          date: '2026-10-14',
          orderType: 'dine-in',
          status: 'paid',
          items: [],
          kotCount: 1,
          bill: { subtotal: 200, discount: 20, gst: 10, totalPayable: 190, generatedAt: '' },
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'o2',
          branchId: 'b_1',
          date: '2026-10-15',
          orderType: 'takeaway',
          status: 'paid',
          items: [],
          kotCount: 1,
          bill: { subtotal: 300, discount: 0, gst: 15, totalPayable: 315, generatedAt: '' },
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'o_void',
          branchId: 'b_1',
          date: '2026-10-15',
          orderType: 'dine-in',
          status: 'voided',
          items: [],
          kotCount: 0,
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'o_out_of_range',
          branchId: 'b_1',
          date: '2026-10-10',
          orderType: 'dine-in',
          status: 'paid',
          items: [],
          kotCount: 1,
          bill: { subtotal: 100, discount: 0, gst: 0, totalPayable: 100, generatedAt: '' },
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
        },
      ]

      mockDb.state.orders = orders

      const res = await getPosOrderHistory('b_1', '2026-10-14', '2026-10-15')
      expect('error' in res).toBe(false)
      if ('error' in res) return

      expect(res.orders.length).toBe(3) // o1, o2, o_void
      expect(res.summary.billCount).toBe(2)
      expect(res.summary.totalRevenue).toBe(505) // 190 + 315
      expect(res.summary.avgOrderValue).toBe(253) // Math.round(505 / 2)
      expect(res.summary.totalVoids).toBe(1)
      expect(res.summary.totalDiscounts).toBe(20)

      expect(audit.logAction).not.toHaveBeenCalled()
    })

    it('denies manager or waiter from accessing order history (Req 7.1)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.getSession).mockResolvedValueOnce({
        role: 'manager',
        isGlobalAdmin: false,
        branchId: 'b_1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const res = await getPosOrderHistory('b_1', '2026-10-14', '2026-10-15')
      expect(res).toEqual({ error: 'Forbidden' })
    })

    it('validates date format and range', async () => {
      const resBadDate = await getPosOrderHistory('b_1', 'invalid', '2026-10-15')
      expect(resBadDate).toEqual({ error: 'Invalid date format' })

      const resInverted = await getPosOrderHistory('b_1', '2026-10-16', '2026-10-15')
      expect(resInverted).toEqual({ error: 'From date must be on or before to date' })
    })
  })

  // ─── 7.3 getDailySummary ──────────────────────────────────────────
  describe('getDailySummary', () => {
    it('returns extended summary including totalCash, totalUpi, and bill breakdown', async () => {
      const today = '2026-10-15'
      const orders: PosOrder[] = [
        {
          id: 'o1',
          branchId: 'b_1',
          date: today,
          orderType: 'dine-in',
          status: 'paid',
          items: [],
          kotCount: 1,
          bill: { subtotal: 100, discount: 0, gst: 0, totalPayable: 100, generatedAt: '' },
          payment: { method: 'cash', cashAmount: 100, upiAmount: 0, paidAt: '' },
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'o2',
          branchId: 'b_1',
          date: today,
          orderType: 'takeaway',
          status: 'paid',
          items: [],
          kotCount: 1,
          bill: { subtotal: 200, discount: 0, gst: 0, totalPayable: 200, generatedAt: '' },
          payment: { method: 'upi', cashAmount: 0, upiAmount: 200, paidAt: '' },
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
        },
      ]

      mockDb.state.orders = orders

      const res = await getDailySummary('b_1', today)
      expect('error' in res).toBe(false)
      if ('error' in res) return

      expect(res.billCount).toBe(2)
      expect(res.totalCash).toBe(100)
      expect(res.totalUpi).toBe(200)
      expect(res.dineInBillCount).toBe(1)
      expect(res.takeawayBillCount).toBe(1)
    })

    it('forbids posRole accounts from accessing daily summary', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.getSession).mockResolvedValueOnce({
        role: 'billing',
        posRole: true,
        branchId: 'b_1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const res = await getDailySummary('b_1', '2026-10-15')
      expect(res).toEqual({ error: 'Forbidden' })
    })
  })

  // ─── 7.4 getPosDataForEOD ─────────────────────────────────────────
  describe('getPosDataForEOD', () => {
    it('returns PosEodData shape without exposing raw orders (Req 6.7)', async () => {
      const today = '2026-10-15'
      const orders: PosOrder[] = [
        {
          id: 'o1',
          branchId: 'b_1',
          date: today,
          orderType: 'dine-in',
          status: 'paid',
          items: [],
          kotCount: 1,
          bill: { subtotal: 100, discount: 0, gst: 5, totalPayable: 105, generatedAt: '' },
          payment: { method: 'cash', cashAmount: 105, upiAmount: 0, paidAt: '' },
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
        },
      ]

      mockDb.state.orders = orders

      const res = await getPosDataForEOD(today, 'b_1')
      expect('error' in res).toBe(false)
      if ('error' in res) return

      expect(res.data).toBeDefined()
      expect(res.data.billCount).toBe(1)
      expect(res.data.totalBillAmount).toBe(105)
      expect(res.data.cashCollectedAsBilled).toBe(105)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((res as any).orders).toBeUndefined() // never leaks raw orders
    })
  })
})
