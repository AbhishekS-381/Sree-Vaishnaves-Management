import { describe, it, expect } from 'vitest'
import {
  POS_DEDICATED_ROLES,
  BRANCH_SCOPED_ROLES,
  canCreateOrder,
  canFireKot,
  canGenerateBill,
  canRecordPayment,
  canAdvanceKot,
  canVoidOrder,
  canViewHistory,
  isWaiterOwnOrder,
} from '@/lib/posUtils'

describe('posUtils.ts - POS capability helpers (Task 1.5)', () => {
  const allRoles = ['admin', 'owner', 'manager', 'waiter', 'billing', 'kitchen', 'readonly', 'guest', '']

  it('exports correct role constants', () => {
    expect(POS_DEDICATED_ROLES).toEqual(['billing', 'kitchen', 'waiter'])
    expect(BRANCH_SCOPED_ROLES).toEqual(['manager', 'billing', 'kitchen', 'waiter'])
  })

  describe('canCreateOrder', () => {
    it('allows manager, owner, admin, waiter', () => {
      const allowed = ['manager', 'owner', 'admin', 'waiter']
      for (const role of allowed) {
        expect(canCreateOrder(role)).toBe(true)
      }
    })

    it('denies billing, kitchen, readonly, and unknown roles', () => {
      const denied = ['billing', 'kitchen', 'readonly', 'guest', '']
      for (const role of denied) {
        expect(canCreateOrder(role)).toBe(false)
      }
    })
  })

  describe('canFireKot', () => {
    it('allows manager, owner, admin, waiter', () => {
      const allowed = ['manager', 'owner', 'admin', 'waiter']
      for (const role of allowed) {
        expect(canFireKot(role)).toBe(true)
      }
    })

    it('denies billing, kitchen, readonly, and unknown roles', () => {
      const denied = ['billing', 'kitchen', 'readonly', 'guest', '']
      for (const role of denied) {
        expect(canFireKot(role)).toBe(false)
      }
    })
  })

  describe('canGenerateBill', () => {
    it('allows manager, owner, admin, billing', () => {
      const allowed = ['manager', 'owner', 'admin', 'billing']
      for (const role of allowed) {
        expect(canGenerateBill(role)).toBe(true)
      }
    })

    it('denies waiter, kitchen, readonly, and unknown roles', () => {
      const denied = ['waiter', 'kitchen', 'readonly', 'guest', '']
      for (const role of denied) {
        expect(canGenerateBill(role)).toBe(false)
      }
    })
  })

  describe('canRecordPayment', () => {
    it('allows manager, owner, admin, billing', () => {
      const allowed = ['manager', 'owner', 'admin', 'billing']
      for (const role of allowed) {
        expect(canRecordPayment(role)).toBe(true)
      }
    })

    it('denies waiter, kitchen, readonly, and unknown roles', () => {
      const denied = ['waiter', 'kitchen', 'readonly', 'guest', '']
      for (const role of denied) {
        expect(canRecordPayment(role)).toBe(false)
      }
    })
  })

  describe('canAdvanceKot', () => {
    it('allows manager, owner, admin, kitchen', () => {
      const allowed = ['manager', 'owner', 'admin', 'kitchen']
      for (const role of allowed) {
        expect(canAdvanceKot(role)).toBe(true)
      }
    })

    it('denies waiter, billing, readonly, and unknown roles', () => {
      const denied = ['waiter', 'billing', 'readonly', 'guest', '']
      for (const role of denied) {
        expect(canAdvanceKot(role)).toBe(false)
      }
    })
  })

  describe('canVoidOrder', () => {
    it('for open orders, allows manager, owner, admin and denies others', () => {
      const allowed = ['manager', 'owner', 'admin']
      for (const role of allowed) {
        expect(canVoidOrder(role, 'open')).toBe(true)
      }
      const denied = ['waiter', 'billing', 'kitchen', 'readonly', 'guest', '']
      for (const role of denied) {
        expect(canVoidOrder(role, 'open')).toBe(false)
      }
    })

    it('for paid orders, allows owner and admin only', () => {
      const allowed = ['owner', 'admin']
      for (const role of allowed) {
        expect(canVoidOrder(role, 'paid')).toBe(true)
      }
      const denied = ['manager', 'waiter', 'billing', 'kitchen', 'readonly', 'guest', '']
      for (const role of denied) {
        expect(canVoidOrder(role, 'paid')).toBe(false)
      }
    })
  })

  describe('canViewHistory', () => {
    it('allows owner and admin only', () => {
      expect(canViewHistory('admin')).toBe(true)
      expect(canViewHistory('owner')).toBe(true)

      const denied = ['manager', 'waiter', 'billing', 'kitchen', 'readonly', 'guest', '']
      for (const role of denied) {
        expect(canViewHistory(role)).toBe(false)
      }
    })
  })

  describe('isWaiterOwnOrder', () => {
    it('checks ownership strictly for waiter role', () => {
      expect(isWaiterOwnOrder('waiter', 'user_1', 'user_1')).toBe(true)
      expect(isWaiterOwnOrder('waiter', 'user_1', 'user_2')).toBe(false)
    })

    it('always returns true for non-waiter roles', () => {
      const nonWaiterRoles = allRoles.filter((r) => r !== 'waiter')
      for (const role of nonWaiterRoles) {
        expect(isWaiterOwnOrder(role, 'user_1', 'user_2')).toBe(true)
        expect(isWaiterOwnOrder(role, 'user_1', 'user_1')).toBe(true)
      }
    })
  })
})
