import { describe, it, expect } from 'vitest'
import { computePosEodData } from '@/lib/posUtils'
import type { PosOrder } from '@/app/actions/posTypes'

/**
 * Reconciles the physical cash counted in the till against expected POS cash collection.
 */
export function reconcileCashDrawer(
  physicalCashCounted: number,
  expectedPosCash: number,
  openingFloat: number = 0
): {
  expectedTotalInTill: number
  variance: number
  reconciliationStatus: 'balanced' | 'shortage' | 'overage'
} {
  const expectedTotalInTill = expectedPosCash + openingFloat
  const variance = physicalCashCounted - expectedTotalInTill

  let reconciliationStatus: 'balanced' | 'shortage' | 'overage' = 'balanced'
  if (variance < 0) reconciliationStatus = 'shortage'
  else if (variance > 0) reconciliationStatus = 'overage'

  return {
    expectedTotalInTill,
    variance,
    reconciliationStatus,
  }
}

/**
 * Validates whether the POS is ready for EOD register closing.
 * Returns warnings/blocks if unsettled orders or unserved KOTs remain.
 */
export function validatePosEodReadiness(
  orders: PosOrder[],
  kots: { id: string; status: string }[] = []
): {
  isReadyForCloseout: boolean
  unsettledOrdersCount: number
  unservedKotsCount: number
  blockingReasons: string[]
} {
  const blockingReasons: string[] = []

  const unsettledOrders = orders.filter(o => o.status === 'open' || o.status === 'billed')
  if (unsettledOrders.length > 0) {
    blockingReasons.push(`${unsettledOrders.length} order(s) remain open or unbilled. Settle or void all active orders before closing register.`)
  }

  const unservedKots = kots.filter(k => k.status === 'pending' || k.status === 'preparing' || k.status === 'ready')
  if (unservedKots.length > 0) {
    blockingReasons.push(`${unservedKots.length} kitchen ticket(s) remain active in kitchen. Mark served or cancel before closing register.`)
  }

  return {
    isReadyForCloseout: blockingReasons.length === 0,
    unsettledOrdersCount: unsettledOrders.length,
    unservedKotsCount: unservedKots.length,
    blockingReasons,
  }
}

describe('POS End-of-Day (EOD) Register Reconciliation - posEodReconciliation.test.ts', () => {
  const samplePaidOrders: PosOrder[] = [
    // Dine-In cash
    {
      id: 'ord-d1',
      branchId: 'br-1',
      tableId: 't1',
      orderType: 'dine-in',
      status: 'paid',
      date: '2026-10-19',
      openedBy: 'u1',
      covers: 4,
      items: [{ id: 'i1', menuItemId: 'm1', quantity: 2, unitPrice: 200 }],
      bill: { subtotal: 400, discount: 20, gst: 19, totalPayable: 399 },
      payment: { method: 'cash', cashAmount: 399, upiAmount: 0, paidAt: '2026-10-19T11:00:00Z' },
    },
    // Dine-In UPI
    {
      id: 'ord-d2',
      branchId: 'br-1',
      tableId: 't2',
      orderType: 'dine-in',
      status: 'paid',
      date: '2026-10-19',
      openedBy: 'u1',
      covers: 2,
      items: [{ id: 'i2', menuItemId: 'm2', quantity: 1, unitPrice: 250 }],
      bill: { subtotal: 250, discount: 0, gst: 12.5, totalPayable: 262.5 },
      payment: { method: 'upi', cashAmount: 0, upiAmount: 262.5, paidAt: '2026-10-19T11:30:00Z' },
    },
    // Takeaway cash
    {
      id: 'ord-t1',
      branchId: 'br-1',
      orderType: 'takeaway',
      takeawayNumber: 'T-1',
      status: 'paid',
      date: '2026-10-19',
      openedBy: 'u1',
      items: [{ id: 'i3', menuItemId: 'm3', quantity: 1, unitPrice: 150 }],
      bill: { subtotal: 150, discount: 0, gst: 7.5, totalPayable: 157.5 },
      payment: { method: 'cash', cashAmount: 157.5, upiAmount: 0, paidAt: '2026-10-19T12:00:00Z' },
    },
    // Takeaway UPI
    {
      id: 'ord-t2',
      branchId: 'br-1',
      orderType: 'takeaway',
      takeawayNumber: 'T-2',
      status: 'paid',
      date: '2026-10-19',
      openedBy: 'u1',
      items: [{ id: 'i4', menuItemId: 'm4', quantity: 2, unitPrice: 100 }],
      bill: { subtotal: 200, discount: 10, gst: 9.5, totalPayable: 199.5 },
      payment: { method: 'upi', cashAmount: 0, upiAmount: 199.5, paidAt: '2026-10-19T12:15:00Z' },
    },
    // Dine-In Split payment
    {
      id: 'ord-split',
      branchId: 'br-1',
      tableId: 't3',
      orderType: 'dine-in',
      status: 'paid',
      date: '2026-10-19',
      openedBy: 'u1',
      covers: 6,
      items: [{ id: 'i5', menuItemId: 'm5', quantity: 3, unitPrice: 200 }],
      bill: { subtotal: 600, discount: 0, gst: 30, totalPayable: 630 },
      payment: { method: 'split', cashAmount: 300, upiAmount: 330, paidAt: '2026-10-19T13:00:00Z' },
    },
    // Voided order
    {
      id: 'ord-void',
      branchId: 'br-1',
      orderType: 'takeaway',
      status: 'voided',
      date: '2026-10-19',
      openedBy: 'u1',
      items: [],
      void: { reason: 'Wrong punch', voidedBy: 'u1', voidedAt: '2026-10-19T13:10:00Z' },
    },
    // Unsettled open order
    {
      id: 'ord-open',
      branchId: 'br-1',
      tableId: 't4',
      orderType: 'dine-in',
      status: 'open',
      date: '2026-10-19',
      openedBy: 'u1',
      items: [{ id: 'i6', menuItemId: 'm1', quantity: 1, unitPrice: 200 }],
    },
  ]

  // =========================================================================
  // 1. computePosEodData Aggregations
  // =========================================================================
  describe('computePosEodData', () => {
    it('accurately computes dine-in cash and dine-in UPI', () => {
      const eod = computePosEodData(samplePaidOrders)
      // Dine-in cash = ord-d1 (399) + ord-split (300) = 699
      expect(eod.dineInCash).toBe(699)
      // Dine-in UPI = ord-d2 (262.5) + ord-split (330) = 592.5
      expect(eod.dineInUpi).toBe(592.5)
    })

    it('accurately computes takeaway cash and takeaway UPI', () => {
      const eod = computePosEodData(samplePaidOrders)
      // Takeaway cash = ord-t1 (157.5)
      expect(eod.takeawayCash).toBe(157.5)
      // Takeaway UPI = ord-t2 (199.5)
      expect(eod.takeawayUpi).toBe(199.5)
    })

    it('sums total bill amount across all paid orders only', () => {
      const eod = computePosEodData(samplePaidOrders)
      // Total = 399 + 262.5 + 157.5 + 199.5 + 630 = 1648.5
      expect(eod.totalBillAmount).toBe(1648.5)
      // Open and voided orders do not count towards billCount
      expect(eod.billCount).toBe(5)
    })

    it('sums cashCollectedAsBilled and upiCollectedAsBilled across all paid orders', () => {
      const eod = computePosEodData(samplePaidOrders)
      // Cash collected = 399 + 157.5 + 300 = 856.5
      expect(eod.cashCollectedAsBilled).toBe(856.5)
      // UPI collected = 262.5 + 199.5 + 330 = 792
      expect(eod.upiCollectedAsBilled).toBe(792)
      // Combined = 856.5 + 792 = 1648.5 (balances totalBillAmount)
      expect(eod.cashCollectedAsBilled + eod.upiCollectedAsBilled).toBe(eod.totalBillAmount)
    })

    it('counts only voided orders towards voids metric', () => {
      const eod = computePosEodData(samplePaidOrders)
      expect(eod.voids).toBe(1)
    })

    it('sums discounts and GST across paid orders', () => {
      const eod = computePosEodData(samplePaidOrders)
      // Discounts = 20 (ord-d1) + 10 (ord-t2) = 30
      expect(eod.discounts).toBe(30)
      // GST = 19 + 12.5 + 7.5 + 9.5 + 30 = 78.5
      expect(eod.gstCollected).toBe(78.5)
    })

    it('handles empty orders list returning all 0s safely', () => {
      const eod = computePosEodData([])
      expect(eod.totalBillAmount).toBe(0)
      expect(eod.billCount).toBe(0)
      expect(eod.dineInCash).toBe(0)
      expect(eod.dineInUpi).toBe(0)
      expect(eod.takeawayCash).toBe(0)
      expect(eod.takeawayUpi).toBe(0)
      expect(eod.voids).toBe(0)
      expect(eod.discounts).toBe(0)
      expect(eod.gstCollected).toBe(0)
    })

    it('includes complimentary ₹0 bills in billCount without affecting revenue', () => {
      const complimentaryOrder: PosOrder = {
        id: 'ord-free',
        branchId: 'br-1',
        orderType: 'takeaway',
        status: 'paid',
        date: '2026-10-19',
        openedBy: 'u1',
        items: [{ id: 'i-f', menuItemId: 'm1', quantity: 1, unitPrice: 100 }],
        bill: { subtotal: 100, discount: 100, gst: 0, totalPayable: 0 },
        payment: { method: 'cash', cashAmount: 0, upiAmount: 0, paidAt: '2026-10-19T14:00:00Z' },
      }

      const eod = computePosEodData([complimentaryOrder])
      expect(eod.billCount).toBe(1)
      expect(eod.totalBillAmount).toBe(0)
      expect(eod.discounts).toBe(100)
    })
  })

  // =========================================================================
  // 2. Cash Drawer Reconciliation (Till Variance)
  // =========================================================================
  describe('reconcileCashDrawer', () => {
    it('reports "balanced" when physical cash matches expected cash + opening float', () => {
      // Expected POS cash = ₹856.5, Opening float = ₹2000 -> Total expected = ₹2856.5
      const res = reconcileCashDrawer(2856.5, 856.5, 2000)
      expect(res.expectedTotalInTill).toBe(2856.5)
      expect(res.variance).toBe(0)
      expect(res.reconciliationStatus).toBe('balanced')
    })

    it('reports "shortage" when physical cash is less than expected (cash leakage)', () => {
      // Expected = ₹2856.5, Physical counted = ₹2800 -> Shortage of ₹56.5
      const res = reconcileCashDrawer(2800, 856.5, 2000)
      expect(res.expectedTotalInTill).toBe(2856.5)
      expect(res.variance).toBe(-56.5)
      expect(res.reconciliationStatus).toBe('shortage')
    })

    it('reports "overage" when physical cash exceeds expected (extra cash in drawer)', () => {
      // Expected = ₹2856.5, Physical counted = ₹2900 -> Overage of ₹43.5
      const res = reconcileCashDrawer(2900, 856.5, 2000)
      expect(res.expectedTotalInTill).toBe(2856.5)
      expect(res.variance).toBe(43.5)
      expect(res.reconciliationStatus).toBe('overage')
    })

    it('handles zero opening float default', () => {
      const res = reconcileCashDrawer(500, 500)
      expect(res.expectedTotalInTill).toBe(500)
      expect(res.variance).toBe(0)
      expect(res.reconciliationStatus).toBe('balanced')
    })
  })

  // =========================================================================
  // 3. EOD Closeout Readiness Verification
  // =========================================================================
  describe('validatePosEodReadiness', () => {
    it('approves closeout when all orders are paid/voided and all KOTs served', () => {
      const closedOrders: PosOrder[] = [
        { ...samplePaidOrders[0], status: 'paid' },
        { ...samplePaidOrders[1], status: 'voided' },
      ]
      const closedKots = [{ id: 'k1', status: 'served' }]

      const res = validatePosEodReadiness(closedOrders, closedKots)
      expect(res.isReadyForCloseout).toBe(true)
      expect(res.unsettledOrdersCount).toBe(0)
      expect(res.unservedKotsCount).toBe(0)
      expect(res.blockingReasons).toEqual([])
    })

    it('blocks closeout when open orders remain', () => {
      const openOrder: PosOrder = { ...samplePaidOrders[0], status: 'open' }
      const res = validatePosEodReadiness([openOrder], [])

      expect(res.isReadyForCloseout).toBe(false)
      expect(res.unsettledOrdersCount).toBe(1)
      expect(res.blockingReasons[0]).toContain('1 order(s) remain open or unbilled')
    })

    it('blocks closeout when billed orders remain unsettled', () => {
      const billedOrder: PosOrder = { ...samplePaidOrders[0], status: 'billed' }
      const res = validatePosEodReadiness([billedOrder], [])

      expect(res.isReadyForCloseout).toBe(false)
      expect(res.unsettledOrdersCount).toBe(1)
      expect(res.blockingReasons[0]).toContain('Settle or void all active orders')
    })

    it('blocks closeout when pending kitchen KOTs remain', () => {
      const activeKots = [
        { id: 'k1', status: 'pending' },
        { id: 'k2', status: 'preparing' },
      ]
      const res = validatePosEodReadiness([], activeKots)

      expect(res.isReadyForCloseout).toBe(false)
      expect(res.unservedKotsCount).toBe(2)
      expect(res.blockingReasons[0]).toContain('2 kitchen ticket(s) remain active')
    })

    it('blocks closeout with multiple reasons when both unsettled orders and active KOTs exist', () => {
      const openOrder: PosOrder = { ...samplePaidOrders[0], status: 'open' }
      const activeKot = { id: 'k1', status: 'ready' }

      const res = validatePosEodReadiness([openOrder], [activeKot])
      expect(res.isReadyForCloseout).toBe(false)
      expect(res.blockingReasons).toHaveLength(2)
    })
  })
})
