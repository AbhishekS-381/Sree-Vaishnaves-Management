import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'
import * as audit from '@/lib/audit'
import {
  generateBill,
  reopenOrder,
  recordPayment,
  voidOrder,
  advanceKotStatus,
} from '@/app/actions/pos'
import type { PosOrder, PosKot } from '@/app/actions/posTypes'

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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('POS Billing, Payment, Void, and KOT Status Actions (Task 6.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(auth, 'getSession').mockResolvedValue({
      userId: 'u_mgr',
      role: 'manager',
      isGlobalAdmin: false,
      branchId: 'b_1',
    } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b_1')
  })

  // ─── 6.1 generateBill ───────────────────────────────────────────────
  describe('generateBill', () => {
    it('generates bill from open order with subtotal, discount, and gst', async () => {
      let savedOrders: PosOrder[] = []
      const order: PosOrder = {
        id: 'ord_1',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'open',
        items: [
          { id: 'oi_1', menuItemId: 'm1', nameSnapshot: 'Idli', quantity: 2, unitPrice: 40 },
          { id: 'oi_2', menuItemId: 'm2', nameSnapshot: 'Dosa', quantity: 1, unitPrice: 70 },
        ],
        kotCount: 1,
        date: '2026-10-15',
        openedBy: 'u1',
        createdAt: '',
        updatedAt: '',
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb: any) => {
        savedOrders = (await cb([order])) as PosOrder[]
        return true
      })

      const fd = new FormData()
      fd.set('orderId', 'ord_1')
      fd.set('discount', '10')
      fd.set('gst', '7') // 5% of 140 approx

      const res = await generateBill({}, fd)
      expect(res).toEqual({ success: true })
      expect(savedOrders[0].status).toBe('billed')
      expect(savedOrders[0].bill).toBeDefined()
      expect(savedOrders[0].bill?.subtotal).toBe(150) // 80 + 70
      expect(savedOrders[0].bill?.discount).toBe(10)
      expect(savedOrders[0].bill?.gst).toBe(7)
      expect(savedOrders[0].bill?.totalPayable).toBe(147) // 150 - 10 + 7

      expect(audit.logAction).toHaveBeenCalledWith(
        'GENERATE_BILL',
        'POS_ORDER',
        expect.stringContaining('"totalPayable":147'),
        'ord_1'
      )
    })

    it('returns already billed order without error (idempotent)', async () => {
      const order: PosOrder = {
        id: 'ord_1',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'billed', // already billed
        items: [{ id: 'oi_1', menuItemId: 'm1', nameSnapshot: 'Idli', quantity: 1, unitPrice: 50 }],
        kotCount: 1,
        bill: { subtotal: 50, discount: 0, gst: 0, totalPayable: 50, generatedAt: '' },
        date: '2026-10-15',
        openedBy: 'u1',
        createdAt: '',
        updatedAt: '',
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
        await cb([order])
        return true
      })

      const fd = new FormData()
      fd.set('orderId', 'ord_1')
      const res = await generateBill({}, fd)
      expect(res).toEqual({ success: true })
    })

    it('rejects bill generation when discount exceeds subtotal', async () => {
      const order: PosOrder = {
        id: 'ord_1',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'open',
        items: [{ id: 'oi_1', menuItemId: 'm1', nameSnapshot: 'Idli', quantity: 1, unitPrice: 50 }],
        kotCount: 1,
        date: '2026-10-15',
        openedBy: 'u1',
        createdAt: '',
        updatedAt: '',
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
        await cb([order])
        return true
      })

      const fd = new FormData()
      fd.set('orderId', 'ord_1')
      fd.set('discount', '60') // > 50

      const res = await generateBill({}, fd)
      expect(res).toEqual({ error: 'Discount cannot exceed the subtotal' })
    })

    it('requires confirmation for zero-payable bill', async () => {
      const order: PosOrder = {
        id: 'ord_1',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'open',
        items: [{ id: 'oi_1', menuItemId: 'm1', nameSnapshot: 'Idli', quantity: 1, unitPrice: 50 }],
        kotCount: 1,
        date: '2026-10-15',
        openedBy: 'u1',
        createdAt: '',
        updatedAt: '',
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
        await cb([order])
        return true
      })

      // Without confirmed flag
      const fd1 = new FormData()
      fd1.set('orderId', 'ord_1')
      fd1.set('discount', '50') // 100% discount
      const res1 = await generateBill({}, fd1)
      expect(res1).toEqual({ error: 'ZERO_BILL_CONFIRM_REQUIRED' })

      // With confirmed flag
      const fd2 = new FormData()
      fd2.set('orderId', 'ord_1')
      fd2.set('discount', '50')
      fd2.set('confirmed', 'true')
      const res2 = await generateBill({}, fd2)
      expect(res2).toEqual({ success: true })
      expect(order.status).toBe('billed')
      expect(order.bill?.totalPayable).toBe(0)
    })

    it('denies kitchen role from generating bill (Req 8.7)', async () => {
      vi.mocked(auth.getSession).mockResolvedValueOnce({
        role: 'kitchen',
        isGlobalAdmin: false,
      } as any)

      const fd = new FormData()
      fd.set('orderId', 'ord_1')
      const res = await generateBill({}, fd)
      expect(res).toEqual({ error: 'Forbidden' })
    })
  })

  // ─── 6.2 reopenOrder ───────────────────────────────────────────────
  describe('reopenOrder', () => {
    it('reopens a billed order and clears bill', async () => {
      let savedOrders: PosOrder[] = []
      const order: PosOrder = {
        id: 'ord_1',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'billed',
        items: [{ id: 'oi_1', menuItemId: 'm1', nameSnapshot: 'Idli', quantity: 1, unitPrice: 50 }],
        kotCount: 1,
        bill: { subtotal: 50, discount: 0, gst: 0, totalPayable: 50, generatedAt: '' },
        date: '2026-10-15',
        openedBy: 'u1',
        createdAt: '',
        updatedAt: '',
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb: any) => {
        savedOrders = (await cb([order])) as PosOrder[]
        return true
      })

      const res = await reopenOrder('ord_1')
      expect(res).toEqual({ success: true })
      expect(savedOrders[0].status).toBe('open')
      expect(savedOrders[0].bill).toBeUndefined()

      expect(audit.logAction).toHaveBeenCalledWith(
        'REOPEN_POS_ORDER',
        'POS_ORDER',
        expect.stringContaining('"orderId":"ord_1"'),
        'ord_1'
      )
    })

    it('strictly forbids reopening a paid order', async () => {
      const order: PosOrder = {
        id: 'ord_1',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'paid', // paid!
        items: [],
        kotCount: 1,
        date: '2026-10-15',
        openedBy: 'u1',
        createdAt: '',
        updatedAt: '',
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
        await cb([order])
        return true
      })

      const res = await reopenOrder('ord_1')
      expect(res).toEqual({ error: 'A paid order cannot be reopened' })
    })
  })

  // ─── 6.3 recordPayment ─────────────────────────────────────────────
  describe('recordPayment', () => {
    it('records pure cash payment and computes changeDue', async () => {
      let savedOrders: PosOrder[] = []
      const order: PosOrder = {
        id: 'ord_1',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'billed',
        items: [],
        kotCount: 1,
        bill: { subtotal: 150, discount: 0, gst: 0, totalPayable: 150, generatedAt: '' },
        date: '2026-10-15',
        openedBy: 'u1',
        createdAt: '',
        updatedAt: '',
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb: any) => {
        savedOrders = (await cb([order])) as PosOrder[]
        return true
      })

      const fd = new FormData()
      fd.set('orderId', 'ord_1')
      fd.set('method', 'cash')
      fd.set('cashTendered', '200')

      const res = await recordPayment({}, fd)
      expect(res).toEqual({ success: true, changeDue: 50 })
      expect(savedOrders[0].status).toBe('paid')
      expect(savedOrders[0].payment?.method).toBe('cash')
      expect(savedOrders[0].payment?.cashAmount).toBe(150)
      expect(savedOrders[0].payment?.upiAmount).toBe(0)

      expect(audit.logAction).toHaveBeenCalledWith(
        'RECORD_PAYMENT',
        'POS_ORDER',
        expect.stringContaining('"method":"cash"'),
        'ord_1'
      )
    })

    it('records split payment and rejects mismatch with totalPayable', async () => {
      const order: PosOrder = {
        id: 'ord_1',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'billed',
        items: [],
        kotCount: 1,
        bill: { subtotal: 100, discount: 0, gst: 0, totalPayable: 100, generatedAt: '' },
        date: '2026-10-15',
        openedBy: 'u1',
        createdAt: '',
        updatedAt: '',
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
        await cb([order])
        return true
      })

      // Mismatch: 50 + 40 = 90 !== 100
      const fdMismatch = new FormData()
      fdMismatch.set('orderId', 'ord_1')
      fdMismatch.set('method', 'split')
      fdMismatch.set('cashAmount', '50')
      fdMismatch.set('upiAmount', '40')
      const resMismatch = await recordPayment({}, fdMismatch)
      expect(resMismatch).toEqual({ error: 'Payment amounts do not balance with total payable' })

      // Balanced: 60 + 40 = 100
      const fdMatch = new FormData()
      fdMatch.set('orderId', 'ord_1')
      fdMatch.set('method', 'split')
      fdMatch.set('cashAmount', '60')
      fdMatch.set('upiAmount', '40')
      fdMatch.set('cashTendered', '60')
      const resMatch = await recordPayment({}, fdMatch)
      expect(resMatch).toEqual({ success: true, changeDue: 0 })
      expect(order.status).toBe('paid')
      expect(order.payment?.cashAmount).toBe(60)
      expect(order.payment?.upiAmount).toBe(40)
    })
  })

  // ─── 6.4 voidOrder ─────────────────────────────────────────────────
  describe('voidOrder', () => {
    it('manager voids an open order with reason', async () => {
      let savedOrders: PosOrder[] = []
      const order: PosOrder = {
        id: 'ord_1',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'open',
        items: [],
        kotCount: 0,
        date: '2026-10-15',
        openedBy: 'u1',
        createdAt: '',
        updatedAt: '',
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb: any) => {
        savedOrders = (await cb([order])) as PosOrder[]
        return true
      })

      const fd = new FormData()
      fd.set('orderId', 'ord_1')
      fd.set('reason', 'Table walked out without ordering')

      const res = await voidOrder({}, fd)
      expect(res).toEqual({ success: true })
      expect(savedOrders[0].status).toBe('voided')
      expect(savedOrders[0].void?.reason).toBe('Table walked out without ordering')

      expect(audit.logAction).toHaveBeenCalledWith(
        'VOID_POS_ORDER',
        'POS_ORDER',
        expect.stringContaining('Table walked out without ordering'),
        'ord_1'
      )
    })

    it('denies billing or kitchen role from voiding open order (Req 8.9)', async () => {
      for (const role of ['billing', 'kitchen']) {
        vi.mocked(auth.getSession).mockResolvedValueOnce({
          userId: 'u_pos',
          role,
          isGlobalAdmin: false,
          branchId: 'b_1',
        } as any)

        const order: PosOrder = {
          id: 'ord_1',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'open',
          items: [],
          kotCount: 0,
          date: '2026-10-15',
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
        }
        vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
          await cb([order])
          return true
        })

        const fd = new FormData()
        fd.set('orderId', 'ord_1')
        fd.set('reason', 'Test')
        const res = await voidOrder({}, fd)
        expect(res).toEqual({ error: 'Forbidden' })
      }
    })

    it('rejects cross-day void for paid order and allows same-day void by admin', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({
        userId: 'u_admin',
        role: 'admin',
        isGlobalAdmin: true,
        branchId: 'b_1',
      } as any)

      // Past day paid order
      const pastPaidOrder: PosOrder = {
        id: 'ord_past',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'paid',
        items: [],
        kotCount: 1,
        date: '2026-10-10',
        payment: { method: 'cash', cashAmount: 100, upiAmount: 0, paidAt: '2026-10-10T12:00:00Z' },
        openedBy: 'u1',
        createdAt: '',
        updatedAt: '',
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
        await cb([pastPaidOrder])
        return true
      })

      const fdPast = new FormData()
      fdPast.set('orderId', 'ord_past')
      fdPast.set('reason', 'Refund')
      const resPast = await voidOrder({}, fdPast)
      expect(resPast).toEqual({ error: 'Order can only be voided on the day it was paid' })

      // Same-day paid order
      const nowIso = new Date().toISOString()
      const todayPaidOrder: PosOrder = {
        id: 'ord_today',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'paid',
        items: [],
        kotCount: 1,
        date: '2026-10-15',
        payment: { method: 'cash', cashAmount: 100, upiAmount: 0, paidAt: nowIso },
        openedBy: 'u1',
        createdAt: '',
        updatedAt: '',
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
        await cb([todayPaidOrder])
        return true
      })

      const fdToday = new FormData()
      fdToday.set('orderId', 'ord_today')
      fdToday.set('reason', 'Double payment refund')
      const resToday = await voidOrder({}, fdToday)
      expect(resToday).toEqual({ success: true })
      expect(todayPaidOrder.status).toBe('voided')
    })
  })

  // ─── 6.5 advanceKotStatus ──────────────────────────────────────────
  describe('advanceKotStatus', () => {
    it('advances KOT sequentially through pending -> preparing -> ready -> served', async () => {
      vi.mocked(auth.getSession).mockResolvedValue({
        userId: 'u_chef',
        role: 'kitchen',
        isGlobalAdmin: false,
        branchId: 'b_1',
      } as any)

      const kot: PosKot = {
        id: 'kot_1',
        orderId: 'ord_1',
        branchId: 'b_1',
        kotNumber: 1,
        items: [],
        status: 'pending',
        firedBy: 'u1',
        firedAt: '',
        updatedAt: '',
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
        await cb([kot])
        return true
      })

      // pending -> preparing
      let res = await advanceKotStatus('kot_1')
      expect(res).toEqual({ success: true })
      expect(kot.status).toBe('preparing')

      // preparing -> ready
      res = await advanceKotStatus('kot_1')
      expect(res).toEqual({ success: true })
      expect(kot.status).toBe('ready')

      // ready -> served
      res = await advanceKotStatus('kot_1')
      expect(res).toEqual({ success: true })
      expect(kot.status).toBe('served')

      // already served -> error
      res = await advanceKotStatus('kot_1')
      expect(res).toEqual({ error: 'KOT is already served' })
    })
  })
})
