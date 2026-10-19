import { describe, it, expect } from 'vitest'
import {
  canCreateOrder,
  canFireKot,
  canGenerateBill,
  canRecordPayment,
  canAdvanceKot,
  canVoidOrder,
  canViewHistory,
  isWaiterOwnOrder,
  computePosEodData,
  POS_DEDICATED_ROLES,
  BRANCH_SCOPED_ROLES,
} from '@/lib/posUtils'
import type { PosOrder } from '@/app/actions/posTypes'

describe('POS Calculation & Utilities In-Depth Suite', () => {
  // ── 1. Role Authorization Matrix (all roles × all capabilities) ──
  describe('Role Authorization Matrix', () => {
    it('POS_DEDICATED_ROLES contains exactly billing, kitchen, waiter', () => {
      expect(POS_DEDICATED_ROLES).toEqual(['billing', 'kitchen', 'waiter'])
    })

    it('BRANCH_SCOPED_ROLES contains manager, billing, kitchen, waiter', () => {
      expect(BRANCH_SCOPED_ROLES).toEqual(['manager', 'billing', 'kitchen', 'waiter'])
    })

    const roles = ['admin', 'owner', 'manager', 'waiter', 'billing', 'kitchen', 'readonly', 'guest', '']

    it('canCreateOrder permissions', () => {
      expect(canCreateOrder('admin')).toBe(true)
      expect(canCreateOrder('owner')).toBe(true)
      expect(canCreateOrder('manager')).toBe(true)
      expect(canCreateOrder('waiter')).toBe(true)
      expect(canCreateOrder('billing')).toBe(false)
      expect(canCreateOrder('kitchen')).toBe(false)
      expect(canCreateOrder('readonly')).toBe(false)
      expect(canCreateOrder('other')).toBe(false)
      expect(canCreateOrder(undefined)).toBe(false)
    })

    it('canFireKot permissions', () => {
      expect(canFireKot('admin')).toBe(true)
      expect(canFireKot('owner')).toBe(true)
      expect(canFireKot('manager')).toBe(true)
      expect(canFireKot('waiter')).toBe(true)
      expect(canFireKot('billing')).toBe(false)
      expect(canFireKot('kitchen')).toBe(false)
      expect(canFireKot('readonly')).toBe(false)
      expect(canFireKot(undefined)).toBe(false)
    })

    it('canGenerateBill permissions', () => {
      expect(canGenerateBill('admin')).toBe(true)
      expect(canGenerateBill('owner')).toBe(true)
      expect(canGenerateBill('manager')).toBe(true)
      expect(canGenerateBill('billing')).toBe(true)
      expect(canGenerateBill('waiter')).toBe(false)
      expect(canGenerateBill('kitchen')).toBe(false)
      expect(canGenerateBill('readonly')).toBe(false)
      expect(canGenerateBill(undefined)).toBe(false)
    })

    it('canRecordPayment permissions', () => {
      expect(canRecordPayment('admin')).toBe(true)
      expect(canRecordPayment('owner')).toBe(true)
      expect(canRecordPayment('manager')).toBe(true)
      expect(canRecordPayment('billing')).toBe(true)
      expect(canRecordPayment('waiter')).toBe(false)
      expect(canRecordPayment('kitchen')).toBe(false)
      expect(canRecordPayment('readonly')).toBe(false)
      expect(canRecordPayment(undefined)).toBe(false)
    })

    it('canAdvanceKot permissions', () => {
      expect(canAdvanceKot('admin')).toBe(true)
      expect(canAdvanceKot('owner')).toBe(true)
      expect(canAdvanceKot('manager')).toBe(true)
      expect(canAdvanceKot('kitchen')).toBe(true)
      expect(canAdvanceKot('waiter')).toBe(false)
      expect(canAdvanceKot('billing')).toBe(false)
      expect(canAdvanceKot('readonly')).toBe(false)
      expect(canAdvanceKot(undefined)).toBe(false)
    })

    it('canVoidOrder permissions', () => {
      expect(canVoidOrder('admin')).toBe(true)
      expect(canVoidOrder('owner')).toBe(true)
      expect(canVoidOrder('manager')).toBe(true)
      expect(canVoidOrder('billing')).toBe(false)
      expect(canVoidOrder('waiter')).toBe(false)
      expect(canVoidOrder('kitchen')).toBe(false)
      expect(canVoidOrder('readonly')).toBe(false)
      expect(canVoidOrder(undefined)).toBe(false)
    })

    it('canViewHistory permissions (Strict Owner / Admin only)', () => {
      expect(canViewHistory('admin')).toBe(true)
      expect(canViewHistory('owner')).toBe(true)
      expect(canViewHistory('manager')).toBe(false)
      expect(canViewHistory('billing')).toBe(false)
      expect(canViewHistory('waiter')).toBe(false)
      expect(canViewHistory('kitchen')).toBe(false)
      expect(canViewHistory('readonly')).toBe(false)
      expect(canViewHistory(undefined)).toBe(false)
    })
  })

  // ── 2. Waiter Ownership Checks ──
  describe('Waiter Ownership Rules (isWaiterOwnOrder)', () => {
    it('Waiter matches own opened order', () => {
      expect(isWaiterOwnOrder('waiter', 'w_123', 'w_123')).toBe(true)
    })

    it('Waiter does not match other waiter order', () => {
      expect(isWaiterOwnOrder('waiter', 'w_456', 'w_123')).toBe(false)
    })

    it('Non-waiter roles always bypass ownership check (manager, admin, owner)', () => {
      expect(isWaiterOwnOrder('manager', 'w_456', 'm_1')).toBe(true)
      expect(isWaiterOwnOrder('admin', 'w_456', 'a_1')).toBe(true)
      expect(isWaiterOwnOrder('owner', 'w_456', 'o_1')).toBe(true)
      expect(isWaiterOwnOrder('billing', 'w_456', 'b_1')).toBe(true)
      expect(isWaiterOwnOrder('kitchen', 'w_456', 'k_1')).toBe(true)
    })
  })

  // ── 3. computePosEodData Calculation Suite ──
  describe('computePosEodData Aggregations', () => {
    it('returns zero aggregates for empty order list', () => {
      const res = computePosEodData([])
      expect(res).toEqual({
        dineInCash: 0,
        dineInUpi: 0,
        takeawayCash: 0,
        takeawayUpi: 0,
        totalBillAmount: 0,
        billCount: 0,
        dineInCovers: 0,
        takeawayOrders: 0,
        cashCollectedAsBilled: 0,
        upiCollectedAsBilled: 0,
        voids: 0,
        discounts: 0,
        gstCollected: 0,
      })
    })

    it('correctly aggregates paid dine-in and takeaway orders', () => {
      const orders: PosOrder[] = [
        {
          id: 'o1',
          branchId: 'b1',
          orderType: 'dine-in',
          status: 'paid',
          items: [],
          kotCount: 1,
          date: '2026-10-19',
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
          bill: { subtotal: 100, discount: 10, gst: 5, totalPayable: 95, generatedAt: '' },
          payment: { method: 'cash', cashAmount: 95, upiAmount: 0, paidAt: '' },
        },
        {
          id: 'o2',
          branchId: 'b1',
          orderType: 'takeaway',
          status: 'paid',
          items: [],
          kotCount: 1,
          date: '2026-10-19',
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
          bill: { subtotal: 200, discount: 20, gst: 9, totalPayable: 189, generatedAt: '' },
          payment: { method: 'upi', cashAmount: 0, upiAmount: 189, paidAt: '' },
        },
      ]

      const res = computePosEodData(orders)
      expect(res.dineInCash).toBe(95)
      expect(res.dineInUpi).toBe(0)
      expect(res.takeawayCash).toBe(0)
      expect(res.takeawayUpi).toBe(189)
      expect(res.totalBillAmount).toBe(95 + 189)
      expect(res.billCount).toBe(2)
      expect(res.dineInCovers).toBe(1)
      expect(res.takeawayOrders).toBe(1)
      expect(res.cashCollectedAsBilled).toBe(95)
      expect(res.upiCollectedAsBilled).toBe(189)
      expect(res.discounts).toBe(30)
      expect(res.gstCollected).toBe(14)
      expect(res.voids).toBe(0)
    })

    it('ignores voided and non-paid orders from revenue, increments voids count', () => {
      const orders: PosOrder[] = [
        {
          id: 'o1',
          branchId: 'b1',
          orderType: 'dine-in',
          status: 'voided',
          items: [],
          kotCount: 1,
          date: '2026-10-19',
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
          bill: { subtotal: 500, discount: 0, gst: 0, totalPayable: 500, generatedAt: '' },
          payment: { method: 'cash', cashAmount: 500, upiAmount: 0, paidAt: '' },
        },
        {
          id: 'o2',
          branchId: 'b1',
          orderType: 'dine-in',
          status: 'open',
          items: [],
          kotCount: 1,
          date: '2026-10-19',
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'o3',
          branchId: 'b1',
          orderType: 'dine-in',
          status: 'billed',
          items: [],
          kotCount: 1,
          date: '2026-10-19',
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
          bill: { subtotal: 300, discount: 0, gst: 0, totalPayable: 300, generatedAt: '' },
        },
        {
          id: 'o4',
          branchId: 'b1',
          orderType: 'dine-in',
          status: 'paid',
          items: [],
          kotCount: 1,
          date: '2026-10-19',
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
          bill: { subtotal: 150, discount: 0, gst: 0, totalPayable: 150, generatedAt: '' },
          payment: { method: 'cash', cashAmount: 150, upiAmount: 0, paidAt: '' },
        },
      ]

      const res = computePosEodData(orders)
      expect(res.cashCollectedAsBilled).toBe(150)
      expect(res.totalBillAmount).toBe(150)
      expect(res.billCount).toBe(1)
      expect(res.voids).toBe(1)
    })

    it('correctly aggregates split payments in PosEodData', () => {
      const orders: PosOrder[] = [
        {
          id: 'o1',
          branchId: 'b1',
          orderType: 'dine-in',
          status: 'paid',
          items: [],
          kotCount: 1,
          date: '2026-10-19',
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
          bill: { subtotal: 500, discount: 0, gst: 0, totalPayable: 500, generatedAt: '' },
          payment: { method: 'split', cashAmount: 300, upiAmount: 200, paidAt: '' },
        },
      ]

      const res = computePosEodData(orders)
      expect(res.dineInCash).toBe(300)
      expect(res.dineInUpi).toBe(200)
      expect(res.cashCollectedAsBilled).toBe(300)
      expect(res.upiCollectedAsBilled).toBe(200)
      expect(res.totalBillAmount).toBe(500)
    })
  })

  // ── 4. Detailed Pricing & Tax Math Formulas ──
  describe('Bill Calculation Math', () => {
    function computeBillMath(subtotal: number, discount: number, gstPercent: number) {
      const discountedSubtotal = Math.max(0, subtotal - discount)
      const gstAmount = Math.round((discountedSubtotal * gstPercent) / 100)
      const totalPayable = discountedSubtotal + gstAmount
      return { subtotal, discount, discountedSubtotal, gstPercent, gstAmount, totalPayable }
    }

    it('Zero discount and zero GST produces exact subtotal', () => {
      const res = computeBillMath(450, 0, 0)
      expect(res.discountedSubtotal).toBe(450)
      expect(res.gstAmount).toBe(0)
      expect(res.totalPayable).toBe(450)
    })

    it('5% GST rounds correctly to nearest rupee', () => {
      // 100 * 5% = 5
      expect(computeBillMath(100, 0, 5).gstAmount).toBe(5)
      expect(computeBillMath(100, 0, 5).totalPayable).toBe(105)

      // 35 * 5% = 1.75 -> rounds to 2
      expect(computeBillMath(35, 0, 5).gstAmount).toBe(2)
      expect(computeBillMath(35, 0, 5).totalPayable).toBe(37)

      // 25 * 5% = 1.25 -> rounds to 1
      expect(computeBillMath(25, 0, 5).gstAmount).toBe(1)
      expect(computeBillMath(25, 0, 5).totalPayable).toBe(26)
    })

    it('12% GST calculation', () => {
      expect(computeBillMath(250, 0, 12).gstAmount).toBe(30)
      expect(computeBillMath(250, 0, 12).totalPayable).toBe(280)
    })

    it('18% GST calculation', () => {
      expect(computeBillMath(500, 50, 18).discountedSubtotal).toBe(450)
      // 450 * 18% = 81
      expect(computeBillMath(500, 50, 18).gstAmount).toBe(81)
      expect(computeBillMath(500, 50, 18).totalPayable).toBe(531)
    })

    it('100% discount (comp/complimentary) produces zero bill', () => {
      const res = computeBillMath(600, 600, 5)
      expect(res.discountedSubtotal).toBe(0)
      expect(res.gstAmount).toBe(0)
      expect(res.totalPayable).toBe(0)
    })

    it('Discount greater than subtotal is clamped to zero', () => {
      const res = computeBillMath(100, 150, 5)
      expect(res.discountedSubtotal).toBe(0)
      expect(res.gstAmount).toBe(0)
      expect(res.totalPayable).toBe(0)
    })

    it('Fractional GST rates (e.g. 2.5% CGST + 2.5% SGST = 5%)', () => {
      const res = computeBillMath(333, 0, 2.5)
      // 333 * 0.025 = 8.325 -> rounds to 8
      expect(res.gstAmount).toBe(8)
      expect(res.totalPayable).toBe(341)
    })

    it('Large subtotal numbers (e.g. banquet ₹1,50,000 with 18% GST)', () => {
      const res = computeBillMath(150000, 15000, 18)
      expect(res.discountedSubtotal).toBe(135000)
      expect(res.gstAmount).toBe(24300)
      expect(res.totalPayable).toBe(159300)
    })

    it('Zero subtotal edge case', () => {
      const res = computeBillMath(0, 0, 5)
      expect(res.discountedSubtotal).toBe(0)
      expect(res.gstAmount).toBe(0)
      expect(res.totalPayable).toBe(0)
    })

    it('Single rupee edge case with 5% GST', () => {
      const res = computeBillMath(1, 0, 5)
      // 1 * 0.05 = 0.05 -> rounds to 0
      expect(res.gstAmount).toBe(0)
      expect(res.totalPayable).toBe(1)
    })

    it('High GST bracket (28% luxury tax)', () => {
      const res = computeBillMath(1000, 100, 28)
      expect(res.discountedSubtotal).toBe(900)
      expect(res.gstAmount).toBe(252)
      expect(res.totalPayable).toBe(1152)
    })
  })

  // ── 5. Payment Tender & Change Due Calculations ──
  describe('Cash Tender & Change Due Math', () => {
    function computeChangeDue(totalPayable: number, cashTendered: number) {
      return Math.max(0, cashTendered - totalPayable)
    }

    it('Exact cash tendered gives 0 change due', () => {
      expect(computeChangeDue(180, 180)).toBe(0)
    })

    it('Higher cash tendered calculates correct change due', () => {
      expect(computeChangeDue(180, 200)).toBe(20)
      expect(computeChangeDue(345, 500)).toBe(155)
      expect(computeChangeDue(1250, 2000)).toBe(750)
    })

    it('Less cash tendered gives 0 change due', () => {
      expect(computeChangeDue(200, 100)).toBe(0)
    })
  })

  // ── 6. Split Payment Math & Validation ──
  describe('Split Payment Balance Validation', () => {
    function validateSplitPayment(totalPayable: number, cash: number, upi: number): boolean {
      if (cash < 0 || upi < 0) return false
      return Math.round(cash + upi) === Math.round(totalPayable)
    }

    it('Valid exact split passes', () => {
      expect(validateSplitPayment(500, 300, 200)).toBe(true)
      expect(validateSplitPayment(150, 100, 50)).toBe(true)
      expect(validateSplitPayment(75, 75, 0)).toBe(true)
      expect(validateSplitPayment(75, 0, 75)).toBe(true)
    })

    it('Mismatch split fails', () => {
      expect(validateSplitPayment(500, 300, 150)).toBe(false)
      expect(validateSplitPayment(500, 300, 250)).toBe(false)
      expect(validateSplitPayment(100, 0, 0)).toBe(false)
    })

    it('Negative numbers fail', () => {
      expect(validateSplitPayment(500, -100, 600)).toBe(false)
      expect(validateSplitPayment(500, 600, -100)).toBe(false)
    })
  })

  // ── 7. Takeaway Sequence Generator Math ──
  describe('Takeaway Number Generator Logic', () => {
    function getNextTakeawayNumber(existingTakeaways: string[]): string {
      const numbers = existingTakeaways
        .map(t => {
          const match = t.match(/^T-(\d+)$/)
          return match ? parseInt(match[1], 10) : 0
        })
        .filter(n => !isNaN(n))

      const max = numbers.length > 0 ? Math.max(...numbers) : 0
      return `T-${max + 1}`
    }

    it('First takeaway is T-1', () => {
      expect(getNextTakeawayNumber([])).toBe('T-1')
    })

    it('Increments sequentially from highest active takeaway number', () => {
      expect(getNextTakeawayNumber(['T-1'])).toBe('T-2')
      expect(getNextTakeawayNumber(['T-1', 'T-2', 'T-3'])).toBe('T-4')
    })

    it('Handles gaps gracefully and picks max + 1', () => {
      expect(getNextTakeawayNumber(['T-1', 'T-5'])).toBe('T-6')
    })

    it('Ignores malformed strings', () => {
      expect(getNextTakeawayNumber(['takeaway_1', 'invalid', 'T-2'])).toBe('T-3')
    })
  })

  // ── 8. KOT Number Daily Branch Generator Math ──
  describe('KOT Number Generator Logic', () => {
    function getNextKotNumber(existingKotsToday: { kotNumber: number }[]): number {
      if (existingKotsToday.length === 0) return 1
      const max = Math.max(...existingKotsToday.map(k => k.kotNumber || 0))
      return max + 1
    }

    it('Starts at 1 for the day', () => {
      expect(getNextKotNumber([])).toBe(1)
    })

    it('Increments sequentially', () => {
      expect(getNextKotNumber([{ kotNumber: 1 }])).toBe(2)
      expect(getNextKotNumber([{ kotNumber: 1 }, { kotNumber: 2 }, { kotNumber: 3 }])).toBe(4)
    })

    it('Handles out of order KOT numbers', () => {
      expect(getNextKotNumber([{ kotNumber: 5 }, { kotNumber: 2 }])).toBe(6)
    })
  })
})
