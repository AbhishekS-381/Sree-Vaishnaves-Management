import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'
import { getPosDataForEOD } from '@/app/actions/pos'
import { computePosEodData } from '@/lib/posUtils'
import type { PosOrder } from '@/app/actions/posTypes'

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

describe('EOD POS Pre-fill Integration Tests (Task 11.3, Req 6.1–6.7)', () => {
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

  it('computePosEodData returns correct aggregates for a mixed-status order array (Req 6.1, 6.2, 6.3)', () => {
    const orders: PosOrder[] = [
      // Dine-in paid
      {
        id: 'ord_1',
        branchId: 'b_1',
        orderType: 'dine-in',
        tableId: 'tbl_1',
        covers: 4,
        status: 'paid',
        items: [{ id: 'i1', menuItemId: 'm1', nameSnapshot: 'Meals', unitPrice: 150, quantity: 4 }],
        kotCount: 1,
        bill: { subtotal: 600, discount: 50, gst: 25, totalPayable: 575, generatedAt: '' },
        payment: { method: 'cash', cashAmount: 575, upiAmount: 0, paidAt: '' },
        date: '2026-10-19',
        openedBy: 'u_waiter',
        createdAt: '',
        updatedAt: '',
      },
      // Takeaway paid
      {
        id: 'ord_2',
        branchId: 'b_1',
        orderType: 'takeaway',
        takeawayNumber: 'T-1',
        status: 'paid',
        items: [{ id: 'i2', menuItemId: 'm2', nameSnapshot: 'Biryani', unitPrice: 200, quantity: 2 }],
        kotCount: 1,
        bill: { subtotal: 400, discount: 0, gst: 20, totalPayable: 420, generatedAt: '' },
        payment: { method: 'upi', cashAmount: 0, upiAmount: 420, paidAt: '' },
        date: '2026-10-19',
        openedBy: 'u_waiter',
        createdAt: '',
        updatedAt: '',
      },
      // Open order (must NOT contribute to revenue)
      {
        id: 'ord_3',
        branchId: 'b_1',
        orderType: 'dine-in',
        tableId: 'tbl_2',
        status: 'open',
        items: [{ id: 'i3', menuItemId: 'm3', nameSnapshot: 'Coffee', unitPrice: 40, quantity: 2 }],
        kotCount: 1,
        date: '2026-10-19',
        openedBy: 'u_waiter',
        createdAt: '',
        updatedAt: '',
      },
      // Voided order (must contribute to voids count only, NOT revenue)
      {
        id: 'ord_4',
        branchId: 'b_1',
        orderType: 'dine-in',
        tableId: 'tbl_3',
        status: 'voided',
        items: [{ id: 'i4', menuItemId: 'm4', nameSnapshot: 'Soup', unitPrice: 80, quantity: 1 }],
        kotCount: 1,
        bill: { subtotal: 80, discount: 0, gst: 0, totalPayable: 80, generatedAt: '' },
        payment: { method: 'cash', cashAmount: 80, upiAmount: 0, paidAt: '' },
        void: { reason: 'Customer cancelled', voidedBy: 'u_admin', voidedAt: '' },
        date: '2026-10-19',
        openedBy: 'u_waiter',
        createdAt: '',
        updatedAt: '',
      },
    ]

    const data = computePosEodData(orders)

    // Income fields
    expect(data.dineInCash).toBe(575)
    expect(data.dineInUpi).toBe(0)
    expect(data.takeawayCash).toBe(0)
    expect(data.takeawayUpi).toBe(420)

    // Billing section fields
    expect(data.totalBillAmount).toBe(995) // 575 + 420
    expect(data.billCount).toBe(2)
    expect(data.dineInCovers).toBe(1) // 1 paid dine-in order
    expect(data.takeawayOrders).toBe(1) // 1 paid takeaway order
    expect(data.voids).toBe(1)
    expect(data.discounts).toBe(50)
    expect(data.cashCollectedAsBilled).toBe(575)
    expect(data.upiCollectedAsBilled).toBe(420)
    expect(data.gstCollected).toBe(45) // 25 + 20
  })

  it('computePosEodData returns all-zero PosEodData when orders array is empty (Req 6.5)', () => {
    const data = computePosEodData([])

    expect(data.dineInCash).toBe(0)
    expect(data.dineInUpi).toBe(0)
    expect(data.takeawayCash).toBe(0)
    expect(data.takeawayUpi).toBe(0)
    expect(data.totalBillAmount).toBe(0)
    expect(data.billCount).toBe(0)
    expect(data.dineInCovers).toBe(0)
    expect(data.takeawayOrders).toBe(0)
    expect(data.cashCollectedAsBilled).toBe(0)
    expect(data.upiCollectedAsBilled).toBe(0)
    expect(data.voids).toBe(0)
    expect(data.discounts).toBe(0)
    expect(data.gstCollected).toBe(0)
  })

  it('getPosDataForEOD returns PosEodData shape without leaking raw orders (Req 6.7)', async () => {
    const today = '2026-10-19'
    vi.mocked(db.readJSON).mockResolvedValueOnce([
      {
        id: 'ord_p',
        branchId: 'b_1',
        orderType: 'dine-in',
        tableId: 't1',
        status: 'paid',
        items: [],
        kotCount: 1,
        bill: { subtotal: 300, discount: 0, gst: 15, totalPayable: 315, generatedAt: '' },
        payment: { method: 'cash', cashAmount: 315, upiAmount: 0, paidAt: '' },
        date: today,
        openedBy: 'u1',
        createdAt: '',
        updatedAt: '',
      },
    ])

    const res = await getPosDataForEOD(today, 'b_1')
    expect('error' in res).toBe(false)
    if ('error' in res) return

    expect(res.data).toBeDefined()
    expect(res.data.billCount).toBe(1)
    expect(res.data.totalBillAmount).toBe(315)
    expect(res.data.dineInCash).toBe(315)
    expect((res as any).orders).toBeUndefined()
  })
})
