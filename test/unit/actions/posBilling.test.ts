import { describe, it, expect, vi, beforeEach } from 'vitest'
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

const { mockDb, mockWithDbTransaction } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state: any = {
    orders: [] as any[],
    kots: [] as any[],
    failNext: false,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCollection = (tableName?: string): any[] => {
    if (tableName === 'pos_orders') return state.orders
    if (tableName === 'pos_kots') return state.kots
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filterItem = (_tableName: string, item: any, str: string): boolean => {
    if (str.includes(`"${item.id}"`)) return true
    return false
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
            if (state.failNext) throw new Error('Database error')
            if (cond) {
              const str = JSON.stringify(cond)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              filtered = collection.filter((item: any) => filterItem(tableName, item, str))
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insert: vi.fn((table: any) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      values: vi.fn((vals: any) => {
        if (state.failNext) throw new Error('Insert failed')
        const collection = getCollection(table?.tableName)
        const row = { ...vals }
        collection.push(row)
        return Promise.resolve([row])
      }),
    })),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: vi.fn((table: any) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set: vi.fn((vals: any) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: vi.fn((cond: any) => {
          if (state.failNext) throw new Error('Update failed')
          const collection = getCollection(table?.tableName)
          const str = JSON.stringify(cond)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          collection.forEach((item: any) => {
            if (str.includes(`"${item.id}"`)) {
              Object.assign(item, vals)
            }
          })
          return Promise.resolve()
        }),
      })),
    })),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockTx = vi.fn(async (cb: any, _options?: any) => {
    if (state.failNext) throw new Error('Transaction failed')
    return cb(mock)
  })

  return { mockDb: mock, mockWithDbTransaction: mockTx }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  withDbTransaction: mockWithDbTransaction,
  posTables: { tableName: 'pos_tables' },
  posOrders: {
    tableName: 'pos_orders',
    id: { name: 'id' },
    branchId: { name: 'branch_id' },
    status: { name: 'status' },
  },
  posKots: {
    tableName: 'pos_kots',
    id: { name: 'id' },
    orderId: { name: 'order_id' },
    status: { name: 'status' },
  },
  menuItems: { tableName: 'menu_items' },
  menuCategories: { tableName: 'menu_categories' },
  menuItemVariants: { tableName: 'menu_item_variants' },
  branchMenuItems: { tableName: 'branch_menu_items' },
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
    mockDb.state.orders = []
    mockDb.state.kots = []
    mockDb.state.failNext = false

    vi.spyOn(auth, 'getSession').mockResolvedValue({
      userId: 'u_mgr',
      role: 'manager',
      isGlobalAdmin: false,
      branchId: 'b_1',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b_1')
  })

  // ─── 6.1 generateBill ───────────────────────────────────────────────
  describe('generateBill', () => {
    it('generates bill from open order with subtotal, discount, and gst', async () => {
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

      mockDb.state.orders = [order]

      const fd = new FormData()
      fd.set('orderId', 'ord_1')
      fd.set('discount', '10')
      fd.set('gst', '7') // 5% of 140 approx

      const res = await generateBill({}, fd)
      expect(res).toEqual({ success: true })
      expect(order.status).toBe('billed')
      expect(order.bill).toBeDefined()
      expect(order.bill?.subtotal).toBe(150) // 80 + 70
      expect(order.bill?.discount).toBe(10)
      expect(order.bill?.gst).toBe(7)
      expect(order.bill?.totalPayable).toBe(147) // 150 - 10 + 7

      expect(audit.logAction).toHaveBeenCalledWith(
        'GENERATE_BILL',
        'POS_ORDER',
        expect.stringContaining('"totalPayable":147'),
        'ord_1'
      )
    })

    it('generates bill with parcel and ac charges properly calculating totalPayable', async () => {
      const order: PosOrder = {
        id: 'ord_ac_parcel',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'open',
        items: [
          { id: 'oi_1', menuItemId: 'm1', nameSnapshot: 'AC Masala Dosa', quantity: 2, unitPrice: 100 },
        ],
        kotCount: 1,
        date: '2026-10-15',
        openedBy: 'u1',
        createdAt: '',
        updatedAt: '',
      }

      mockDb.state.orders = [order]

      const fd = new FormData()
      fd.set('orderId', 'ord_ac_parcel')
      fd.set('discount', '20')
      fd.set('parcelCharges', '15')
      fd.set('acCharges', '25')
      fd.set('gst', '10')

      const res = await generateBill({}, fd)
      expect(res).toEqual({ success: true })
      expect(order.status).toBe('billed')
      expect(order.bill?.subtotal).toBe(200)
      expect(order.bill?.discount).toBe(20)
      expect(order.bill?.parcelCharges).toBe(15)
      expect(order.bill?.acCharges).toBe(25)
      expect(order.bill?.gst).toBe(10)
      expect(order.bill?.totalPayable).toBe(230) // 200 - 20 + 15 + 25 + 10
    })

    it('generates consolidated bill for mixed dine-in table order with takeaway/parcel items', async () => {
      const order: PosOrder = {
        id: 'ord_mixed_bill',
        branchId: 'b_1',
        orderType: 'dine-in',
        tableId: 't1',
        status: 'open',
        items: [
          { id: 'i1', menuItemId: 'm1', nameSnapshot: 'Masala Dosa', quantity: 2, unitPrice: 60, isParcel: false },
          { id: 'i2', menuItemId: 'm2', nameSnapshot: 'Paneer Butter Masala', quantity: 1, unitPrice: 200, isParcel: true },
        ],
        kotCount: 1,
        date: '2026-10-15',
        openedBy: 'u1',
        createdAt: '',
        updatedAt: '',
      }

      mockDb.state.orders = [order]

      // Subtotal = 120 + 200 = 320
      // Dine-in subtotal = 120, AC charge (10%) = 12
      // Parcel subtotal = 200, Parcel charge (5%) = 10
      // GST (5% of 320) = 16
      const fd = new FormData()
      fd.set('orderId', 'ord_mixed_bill')
      fd.set('discount', '0')
      fd.set('parcelCharges', '10')
      fd.set('acCharges', '12')
      fd.set('gst', '16')

      const res = await generateBill({}, fd)
      expect(res).toEqual({ success: true })
      expect(order.status).toBe('billed')
      expect(order.bill?.subtotal).toBe(320)
      expect(order.bill?.parcelCharges).toBe(10)
      expect(order.bill?.acCharges).toBe(12)
      expect(order.bill?.gst).toBe(16)
      expect(order.bill?.totalPayable).toBe(358) // 320 + 10 + 12 + 16
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

      mockDb.state.orders = [order]

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

      mockDb.state.orders = [order]

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

      mockDb.state.orders = [order]

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.getSession).mockResolvedValueOnce({
        role: 'kitchen',
        isGlobalAdmin: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      mockDb.state.orders = [order]

      const res = await reopenOrder('ord_1')
      expect(res).toEqual({ success: true })
      expect(order.status).toBe('open')
      expect(order.bill).toBeNull()

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

      mockDb.state.orders = [order]

      const res = await reopenOrder('ord_1')
      expect(res).toEqual({ error: 'A paid order cannot be reopened' })
    })
  })

  // ─── 6.3 recordPayment ─────────────────────────────────────────────
  describe('recordPayment', () => {
    it('records pure cash payment and computes changeDue', async () => {
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

      mockDb.state.orders = [order]

      const fd = new FormData()
      fd.set('orderId', 'ord_1')
      fd.set('method', 'cash')
      fd.set('cashTendered', '200')

      const res = await recordPayment({}, fd)
      expect(res).toEqual({ success: true, changeDue: 50 })
      expect(order.status).toBe('paid')
      expect(order.payment?.method).toBe('cash')
      expect(order.payment?.cashAmount).toBe(150)
      expect(order.payment?.upiAmount).toBe(0)

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

      mockDb.state.orders = [order]

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

      mockDb.state.orders = [order]

      const fd = new FormData()
      fd.set('orderId', 'ord_1')
      fd.set('reason', 'Table walked out without ordering')

      const res = await voidOrder({}, fd)
      expect(res).toEqual({ success: true })
      expect(order.status).toBe('voided')
      expect(order.void?.reason).toBe('Table walked out without ordering')

      expect(audit.logAction).toHaveBeenCalledWith(
        'VOID_POS_ORDER',
        'POS_ORDER',
        expect.stringContaining('Table walked out without ordering'),
        'ord_1'
      )
    })

    it('denies billing or kitchen role from voiding open order (Req 8.9)', async () => {
      for (const role of ['billing', 'kitchen']) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(auth.getSession).mockResolvedValueOnce({
          userId: 'u_pos',
          role,
          isGlobalAdmin: false,
          branchId: 'b_1',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        mockDb.state.orders = [order]

        const fd = new FormData()
        fd.set('orderId', 'ord_1')
        fd.set('reason', 'Test')
        const res = await voidOrder({}, fd)
        expect(res).toEqual({ error: 'Forbidden' })
      }
    })

    it('rejects cross-day void for paid order and allows same-day void by admin', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.getSession).mockResolvedValue({
        userId: 'u_admin',
        role: 'admin',
        isGlobalAdmin: true,
        branchId: 'b_1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      mockDb.state.orders = [pastPaidOrder]

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

      mockDb.state.orders = [todayPaidOrder]

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.getSession).mockResolvedValue({
        userId: 'u_chef',
        role: 'kitchen',
        isGlobalAdmin: false,
        branchId: 'b_1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      mockDb.state.kots = [kot]

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
