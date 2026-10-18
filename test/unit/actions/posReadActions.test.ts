import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'
import * as audit from '@/lib/audit'
import {
  getKitchenKots,
  getPosOrderHistory,
  getDailySummary,
  getPosDataForEOD,
} from '@/app/actions/pos'
import type { PosOrder, PosKot, PosTable } from '@/app/actions/posTypes'

vi.mock('@/lib/db', () => ({
  readJSON: vi.fn(),
  withTransaction: vi.fn(),
  readBranchMenuItems: vi.fn(),
  DB_FILES: {
    POS_TABLES: 'pos_tables.json',
    POS_ORDERS: 'pos_orders.json',
    POS_KOTS: 'pos_kots.json',
  },
}))

vi.mock('@/lib/audit', () => ({
  logAction: vi.fn().mockResolvedValue(true),
}))

describe('POS Read Actions & Audit Guarantees (Tasks 7.1–7.5, Req 12.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(auth, 'getSession').mockResolvedValue({
      userId: 'u_admin',
      role: 'admin',
      isGlobalAdmin: true,
      branchId: 'b_1',
    } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b_1')
  })

  // ─── 7.1 getKitchenKots ───────────────────────────────────────────
  describe('getKitchenKots', () => {
    it('returns active KOTs in FIFO order with identifiers and strips financial data', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({
        userId: 'u_chef',
        role: 'kitchen',
        isGlobalAdmin: false,
        branchId: 'b_1',
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

      vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
        if (file === 'pos_orders.json') return orders
        if (file === 'pos_tables.json') return tables
        if (file === 'pos_kots.json') return kots
        return []
      })

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
          expect((item as any).unitPrice).toBeUndefined()
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

      vi.mocked(db.readJSON).mockImplementation(async () => orders)

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
      vi.mocked(auth.getSession).mockResolvedValueOnce({
        role: 'manager',
        isGlobalAdmin: false,
        branchId: 'b_1',
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

      vi.mocked(db.readJSON).mockImplementation(async () => orders)

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
      vi.mocked(auth.getSession).mockResolvedValueOnce({
        role: 'billing',
        posRole: true,
        branchId: 'b_1',
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

      vi.mocked(db.readJSON).mockImplementation(async () => orders)

      const res = await getPosDataForEOD(today, 'b_1')
      expect('error' in res).toBe(false)
      if ('error' in res) return

      expect(res.data).toBeDefined()
      expect(res.data.billCount).toBe(1)
      expect(res.data.totalBillAmount).toBe(105)
      expect(res.data.cashCollectedAsBilled).toBe(105)
      expect((res as any).orders).toBeUndefined() // never leaks raw orders
    })
  })
})
