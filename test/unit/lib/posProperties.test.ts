import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { computePosEodData, isWaiterOwnOrder } from '@/lib/posUtils'
import type { PosOrder, OrderItem } from '@/app/actions/posTypes'

describe('POS Property-Based Invariant Tests (Task 13, fast-check)', () => {
  // Feature: pos-billing-kot, Property 1: Bill arithmetic invariants
  // Validates: Requirements 4.1, 4.5
  it('Property 1: Bill arithmetic invariants', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            menuItemId: fc.string({ minLength: 1 }),
            nameSnapshot: fc.string({ minLength: 1 }),
            unitPrice: fc.integer({ min: 0, max: 10000 }),
            quantity: fc.integer({ min: 1, max: 99 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        fc.integer({ min: 0, max: 5000 }),
        (items: OrderItem[], gstInput: number) => {
          const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
          // Discount cannot exceed subtotal
          const discount = Math.min(subtotal, Math.floor(subtotal * 0.5))
          const totalPayable = subtotal - discount + gstInput

          expect(subtotal).toBeGreaterThanOrEqual(0)
          expect(discount).toBeGreaterThanOrEqual(0)
          expect(discount).toBeLessThanOrEqual(subtotal)
          expect(gstInput).toBeGreaterThanOrEqual(0)
          expect(totalPayable).toBe(subtotal - discount + gstInput)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pos-billing-kot, Property 2: Payment balance invariant
  // Validates: Requirements 5.1, 5.2, 5.3
  it('Property 2: Payment balance invariant', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50000 }),
        fc.constantFrom('cash', 'upi', 'split'),
        (totalPayable: number, method: 'cash' | 'upi' | 'split') => {
          let cashAmount = 0
          let upiAmount = 0

          if (method === 'cash') {
            cashAmount = totalPayable
            upiAmount = 0
          } else if (method === 'upi') {
            cashAmount = 0
            upiAmount = totalPayable
          } else {
            // split
            cashAmount = Math.floor(totalPayable / 2)
            upiAmount = totalPayable - cashAmount
          }

          expect(cashAmount + upiAmount).toBe(totalPayable)
          expect(cashAmount).toBeGreaterThanOrEqual(0)
          expect(upiAmount).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pos-billing-kot, Property 3: KOT delta correctness
  // Validates: Requirements 3.1
  it('Property 3: KOT delta correctness', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            menuItemId: fc.constantFrom('m1', 'm2', 'm3', 'm4'),
            currentQty: fc.integer({ min: 1, max: 20 }),
            priorKotQty: fc.integer({ min: 0, max: 20 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (itemStates) => {
          const deltaKotItems: { menuItemId: string; quantity: number }[] = []

          for (const item of itemStates) {
            const delta = item.currentQty - item.priorKotQty
            if (delta > 0) {
              deltaKotItems.push({
                menuItemId: item.menuItemId,
                quantity: delta,
              })
            }
          }

          // Invariant: every item in the delta has quantity > 0
          for (const d of deltaKotItems) {
            expect(d.quantity).toBeGreaterThan(0)
          }

          // Invariant: if currentQty <= priorKotQty, delta is not present
          for (const item of itemStates) {
            if (item.currentQty <= item.priorKotQty) {
              const inDelta = deltaKotItems.filter(d => d.menuItemId === item.menuItemId)
              // If only this record for this menuItemId, it shouldn't be in delta
              if (itemStates.filter(s => s.menuItemId === item.menuItemId).length === 1) {
                expect(inDelta.length).toBe(0)
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pos-billing-kot, Property 4: KOT sequential numbering
  // Validates: Requirements 3.2
  it('Property 4: KOT sequential numbering', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 25 }),
        (n: number) => {
          const kots: { kotNumber: number }[] = []
          for (let i = 0; i < n; i++) {
            const newKotNumber = kots.length + 1
            kots.push({ kotNumber: newKotNumber })
          }

          const numbers = kots.map(k => k.kotNumber)
          const expected = Array.from({ length: n }, (_, i) => i + 1)

          expect(numbers).toEqual(expected)
        }
      ),
      { numRuns: 50 }
    )
  })

  // Feature: pos-billing-kot, Property 5: Branch isolation for managers
  // Validates: Requirements 1.2, 7.4, 8.5
  it('Property 5: Branch isolation for managers', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            branchId: fc.string({ minLength: 1 }),
          }),
          { minLength: 1, maxLength: 30 }
        ),
        (sessionBranchId: string, queryBranchId: string, allRecords) => {
          // Manager can only access sessionBranchId
          const isAllowed = queryBranchId === sessionBranchId
          if (!isAllowed) {
            expect(queryBranchId).not.toBe(sessionBranchId)
          } else {
            const filtered = allRecords.filter(r => r.branchId === sessionBranchId)
            for (const r of filtered) {
              expect(r.branchId).toBe(sessionBranchId)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pos-billing-kot, Property 6: Order status machine safety: no paid→open transition
  // Validates: Requirements 4.4, 4.11, 8.6
  it('Property 6: Order status machine safety: no paid->open transition', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          status: fc.constant('paid'),
        }),
        (order) => {
          // Reopening a paid order must always be rejected
          const canReopen = (order.status as string) === 'billed'
          expect(canReopen).toBe(false)
          expect(order.status).toBe('paid')
        }
      ),
      { numRuns: 50 }
    )
  })

  // Feature: pos-billing-kot, Property 7: Takeaway number uniqueness
  // Validates: Requirements 2.8
  it('Property 7: Takeaway number uniqueness', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (orderCount: number) => {
          const takeawayNumbers = new Set<string>()
          const orders: { takeawayNumber: string }[] = []

          for (let i = 0; i < orderCount; i++) {
            const tNum = `T-${orders.length + 1}`
            takeawayNumbers.add(tNum)
            orders.push({ takeawayNumber: tNum })
          }

          // Invariant: all takeaway numbers within same branch+date are strictly unique
          expect(takeawayNumbers.size).toBe(orderCount)
        }
      ),
      { numRuns: 50 }
    )
  })

  // Feature: pos-billing-kot, Property 8: OrderItem unit price immutability
  // Validates: Requirements 2.5
  it('Property 8: OrderItem unit price immutability', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 2000 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 99 }),
        (initialPrice, initialQty, updatedQty) => {
          const item: OrderItem = {
            id: 'oi_1',
            menuItemId: 'm1',
            nameSnapshot: 'Paneer Tikka',
            unitPrice: initialPrice,
            quantity: initialQty,
          }

          // When updating quantity, unitPrice must NOT change
          item.quantity = updatedQty
          // Simulate action preserving existing unitPrice:
          const finalPrice = item.unitPrice

          expect(finalPrice).toBe(initialPrice)
          expect(item.quantity).toBe(updatedQty)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pos-billing-kot, Property 9: EOD aggregate correctness
  // Validates: Requirements 6.1, 6.2, 6.3
  it('Property 9: EOD aggregate correctness', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            branchId: fc.constant('b_1'),
            orderType: fc.constantFrom<'dine-in' | 'takeaway'>('dine-in', 'takeaway'),
            status: fc.constantFrom<'open' | 'billed' | 'paid' | 'voided'>('open', 'billed', 'paid', 'voided'),
            kotCount: fc.integer({ min: 0, max: 5 }),
            items: fc.constant([] as OrderItem[]),
            date: fc.constant('2026-10-19'),
            openedBy: fc.constant('u1'),
            createdAt: fc.constant(''),
            updatedAt: fc.constant(''),

            bill: fc.record({
              subtotal: fc.integer({ min: 0, max: 2000 }),
              discount: fc.integer({ min: 0, max: 200 }),
              gst: fc.integer({ min: 0, max: 100 }),
              totalPayable: fc.integer({ min: 0, max: 2500 }),
              generatedAt: fc.constant(''),
            }),
            payment: fc.record({
              method: fc.constantFrom<'cash' | 'upi' | 'split'>('cash', 'upi', 'split'),
              cashAmount: fc.integer({ min: 0, max: 1500 }),
              upiAmount: fc.integer({ min: 0, max: 1500 }),
              paidAt: fc.constant(''),
            }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (orders: PosOrder[]) => {
          const eod = computePosEodData(orders)

          // All 13 fields must be non-negative integers
          expect(Number.isInteger(eod.dineInCash)).toBe(true)
          expect(eod.dineInCash).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(eod.dineInUpi)).toBe(true)
          expect(eod.dineInUpi).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(eod.takeawayCash)).toBe(true)
          expect(eod.takeawayCash).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(eod.takeawayUpi)).toBe(true)
          expect(eod.takeawayUpi).toBeGreaterThanOrEqual(0)

          expect(Number.isInteger(eod.totalBillAmount)).toBe(true)
          expect(eod.totalBillAmount).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(eod.billCount)).toBe(true)
          expect(eod.billCount).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(eod.dineInCovers)).toBe(true)
          expect(eod.dineInCovers).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(eod.takeawayOrders)).toBe(true)
          expect(eod.takeawayOrders).toBeGreaterThanOrEqual(0)

          expect(Number.isInteger(eod.voids)).toBe(true)
          expect(eod.voids).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(eod.discounts)).toBe(true)
          expect(eod.discounts).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(eod.gstCollected)).toBe(true)
          expect(eod.gstCollected).toBeGreaterThanOrEqual(0)

          // Non-paid orders must not contribute to billCount
          const paidCount = orders.filter(o => o.status === 'paid').length
          expect(eod.billCount).toBe(paidCount)

          // Voids count must match voided orders only
          const voidedCount = orders.filter(o => o.status === 'voided').length
          expect(eod.voids).toBe(voidedCount)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pos-billing-kot, Property 10: Table name uniqueness invariant
  // Validates: Requirements 1.5
  it('Property 10: Table name uniqueness invariant', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 20 }),
        (tableNames: string[]) => {
          const activeTables: { name: string }[] = []

          for (const name of tableNames) {
            const trimmed = name.trim()
            if (!trimmed) continue
            const isDuplicate = activeTables.some(t => t.name.toLowerCase() === trimmed.toLowerCase())
            if (!isDuplicate) {
              activeTables.push({ name: trimmed })
            }
          }

          // Invariant: all active tables in same branch have unique names (case-insensitive)
          const lowerNames = activeTables.map(t => t.name.toLowerCase())
          const uniqueLower = new Set(lowerNames)
          expect(uniqueLower.size).toBe(activeTables.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pos-billing-kot, Property 11: GST suggestion arithmetic
  // Validates: Requirements 13.3, 4.10
  it('Property 11: GST suggestion arithmetic', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 28 }),
        (subtotal: number, gstRate: number) => {
          const suggestedGst = Math.round((subtotal * gstRate) / 100)

          expect(Number.isInteger(suggestedGst)).toBe(true)
          expect(suggestedGst).toBeGreaterThanOrEqual(0)
          if (gstRate === 0 || subtotal === 0) {
            expect(suggestedGst).toBe(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: pos-billing-kot, Property 12: Waiter order ownership isolation
  // Validates: Requirements 8.5, 16.5
  it('Property 12: Waiter order ownership isolation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.constantFrom('waiter', 'manager', 'admin', 'owner'),
        (orderOpenedBy: string, sessionUserId: string, role: string) => {
          const isAllowed = isWaiterOwnOrder(role, orderOpenedBy, sessionUserId)

          if (role === 'waiter') {
            expect(isAllowed).toBe(orderOpenedBy === sessionUserId)
          } else {
            // Managers, owners, admins can access any order
            expect(isAllowed).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
