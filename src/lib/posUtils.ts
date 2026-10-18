// ─── POS Role Capability Helpers ──────────────────────────────────
// Pure functions that encode the POS role→permission matrix.
// Imported by: pos.ts (server actions), client components, tests.
// Located in src/lib/ (not inside actions/) to avoid circular deps
// with eod/page.tsx and test files.

/** The three POS-dedicated roles that get a `posRole: true` JWT flag. */
export const POS_DEDICATED_ROLES = ['billing', 'kitchen', 'waiter'] as const

/** All roles that are scoped to a single branch and require a branchId. */
export const BRANCH_SCOPED_ROLES = ['manager', 'billing', 'kitchen', 'waiter'] as const

/** Can create orders and add/edit items (Req 8.4, 8.5). */
export function canCreateOrder(role: string): boolean {
  return ['manager', 'owner', 'admin', 'waiter'].includes(role)
}

/** Can fire KOTs to the kitchen (Req 8.4, 8.5). */
export function canFireKot(role: string): boolean {
  return ['manager', 'owner', 'admin', 'waiter'].includes(role)
}

/** Can generate a bill from an open/billed order (Req 8.6). */
export function canGenerateBill(role: string): boolean {
  return ['manager', 'owner', 'admin', 'billing'].includes(role)
}

/** Can record payment on a billed order (Req 8.6). */
export function canRecordPayment(role: string): boolean {
  return ['manager', 'owner', 'admin', 'billing'].includes(role)
}

/** Can advance KOT status in the kitchen (Req 8.7). */
export function canAdvanceKot(role: string): boolean {
  return ['manager', 'owner', 'admin', 'kitchen'].includes(role)
}

/**
 * Can void an order. Rules differ by order status (Req 8.8, 8.9):
 * - `paid` orders: owner or admin only
 * - `open` orders: manager, owner, or admin (not waiter/billing/kitchen)
 */
export function canVoidOrder(role: string, status: 'open' | 'paid'): boolean {
  if (status === 'paid') return ['owner', 'admin'].includes(role)
  return ['manager', 'owner', 'admin'].includes(role)
}

/** Can access the order history view (Req 7.1 — owner/admin only). */
export function canViewHistory(role: string): boolean {
  return ['owner', 'admin'].includes(role)
}

/**
 * Checks if a waiter is accessing their own order (Req 8.5, 16.5).
 * Non-waiter roles always return true (no ownership restriction).
 */
export function isWaiterOwnOrder(role: string, openedBy: string, sessionUserId: string): boolean {
  if (role !== 'waiter') return true // non-waiters can access any order
  return openedBy === sessionUserId
}

import type { PosOrder, PosEodData } from '@/app/actions/posTypes'

/**
 * Computes the EOD pre-fill data from a filtered array of PosOrders.
 * Called by EOD page.tsx and getDailySummary. Accepts orders already
 * filtered by date and branchId.
 *
 * Only `paid` orders contribute to revenue aggregates.
 * Only `voided` orders contribute to the `voids` count.
 */
export function computePosEodData(orders: PosOrder[]): PosEodData {
  const paid     = orders.filter(o => o.status === 'paid')
  const dineIn   = paid.filter(o => o.orderType === 'dine-in')
  const takeaway = paid.filter(o => o.orderType === 'takeaway')
  const voided   = orders.filter(o => o.status === 'voided')

  return {
    dineInCash:            dineIn.reduce((s, o) => s + (o.payment?.cashAmount ?? 0), 0),
    dineInUpi:             dineIn.reduce((s, o) => s + (o.payment?.upiAmount ?? 0), 0),
    takeawayCash:          takeaway.reduce((s, o) => s + (o.payment?.cashAmount ?? 0), 0),
    takeawayUpi:           takeaway.reduce((s, o) => s + (o.payment?.upiAmount ?? 0), 0),
    totalBillAmount:       paid.reduce((s, o) => s + (o.bill?.totalPayable ?? 0), 0),
    billCount:             paid.length,
    dineInCovers:          dineIn.length,
    takeawayOrders:        takeaway.length,
    cashCollectedAsBilled: paid.reduce((s, o) => s + (o.payment?.cashAmount ?? 0), 0),
    upiCollectedAsBilled:  paid.reduce((s, o) => s + (o.payment?.upiAmount ?? 0), 0),
    voids:                 voided.length,
    discounts:             paid.reduce((s, o) => s + (o.bill?.discount ?? 0), 0),
    gstCollected:          paid.reduce((s, o) => s + (o.bill?.gst ?? 0), 0),
  }
}

