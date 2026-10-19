import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createTable,
  createOrder,
  addOrUpdateOrderItem,
  generateBill,
  recordPayment,
  reopenOrder,
  voidOrder,
  fireKot,
} from '@/app/actions/pos'
import { DB_FILES } from '@/lib/db'
import type { PosOrder, PosTable, PosKot } from '@/app/actions/posTypes'

// Mocks
const { authMocks, dbMocks, auditMocks } = vi.hoisted(() => ({
  authMocks: {
    getSession: vi.fn(),
    requireBranchAccess: vi.fn(),
  },
  dbMocks: {
    readJSON: vi.fn(),
    withTransaction: vi.fn(),
  },
  auditMocks: {
    logAction: vi.fn(),
  },
}))

vi.mock('@/app/actions/auth', () => ({
  getSession: authMocks.getSession,
  requireBranchAccess: authMocks.requireBranchAccess,
}))

vi.mock('@/lib/db', () => ({
  readJSON: dbMocks.readJSON,
  withTransaction: dbMocks.withTransaction,
  DB_FILES: {
    POS_TABLES: 'pos_tables.json',
    POS_ORDERS: 'pos_orders.json',
    POS_KOTS: 'pos_kots.json',
  },
}))

vi.mock('@/lib/audit', () => ({
  logAction: auditMocks.logAction,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('POS Concurrency & Transaction Safety - posConcurrency.test.ts', () => {
  const managerSession = { userId: 'u_mgr', name: 'Manager Bob', role: 'manager', isGlobalAdmin: false, branchId: 'br-1' }
  const waiterSession = { userId: 'u_waiter', name: 'Waiter Dave', role: 'waiter', isGlobalAdmin: false, branchId: 'br-1' }

  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.getSession.mockResolvedValue(managerSession)
    authMocks.requireBranchAccess.mockImplementation(async (bId?: string) => bId || 'br-1')
    auditMocks.logAction.mockResolvedValue(undefined)
  })

  // =========================================================================
  // 1. Concurrent Table Operations
  // =========================================================================
  describe('Concurrent Table Operations', () => {
    it('prevents exceeding 50 tables when concurrent creates arrive at limit boundary', async () => {
      // In-memory persistent table store for transaction serialization
      const tableStore: PosTable[] = Array.from({ length: 49 }, (_, i) => ({
        id: `tbl_${i}`,
        branchId: 'br-1',
        name: `Table ${i + 1}`,
        isActive: true,
        createdAt: '2026-10-19T00:00:00Z',
        updatedAt: '2026-10-19T00:00:00Z',
      }))

      // Serialize transactions
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: (items: PosTable[]) => PosTable[]) => {
        const result = callback(tableStore)
        return true
      })

      const fd1 = new FormData()
      fd1.set('name', 'Table 50')
      fd1.set('branchId', 'br-1')

      const fd2 = new FormData()
      fd2.set('name', 'Table 51')
      fd2.set('branchId', 'br-1')

      // First request succeeds (reaches 50)
      const res1 = await createTable(null, fd1)
      expect(res1.success).toBe(true)

      // Second concurrent request must be rejected because activeTables.length is now 50
      const res2 = await createTable(null, fd2)
      expect(res2.error).toBe('Active table limit (50) reached')
      expect(tableStore.length).toBe(50)
    })

    it('prevents duplicate table names when two clients submit the same name simultaneously', async () => {
      const tableStore: PosTable[] = []
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: (items: PosTable[]) => PosTable[]) => {
        callback(tableStore)
        return true
      })

      const fd1 = new FormData()
      fd1.set('name', 'Patio Corner')
      fd1.set('branchId', 'br-1')

      const fd2 = new FormData()
      fd2.set('name', 'patio corner') // Same name lower-case
      fd2.set('branchId', 'br-1')

      const res1 = await createTable(null, fd1)
      expect(res1.success).toBe(true)

      const res2 = await createTable(null, fd2)
      expect(res2.error).toBe('A table with this name already exists')
    })
  })

  // =========================================================================
  // 2. Concurrent Order Creation on Same Table
  // =========================================================================
  describe('Concurrent Order Creation on Same Table', () => {
    it('only one waiter wins when attempting to seat the same table concurrently', async () => {
      const orderStore: PosOrder[] = []
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: (items: PosOrder[]) => PosOrder[]) => {
        callback(orderStore)
        return true
      })

      const fd1 = new FormData()
      fd1.set('orderType', 'dine-in')
      fd1.set('tableId', 'tbl-5')
      fd1.set('branchId', 'br-1')
      fd1.set('covers', '4')

      const fd2 = new FormData()
      fd2.set('orderType', 'dine-in')
      fd2.set('tableId', 'tbl-5')
      fd2.set('branchId', 'br-1')
      fd2.set('covers', '2')

      const [res1, res2] = await Promise.all([
        createOrder(null, fd1),
        createOrder(null, fd2),
      ])

      const successes = [res1, res2].filter(r => r.success === true)
      const errors = [res1, res2].filter(r => r.error === 'Table already has an open order')

      expect(successes).toHaveLength(1)
      expect(errors).toHaveLength(1)
      expect(orderStore.filter(o => o.tableId === 'tbl-5')).toHaveLength(1)
    })
  })

  // =========================================================================
  // 3. Item Operations vs State Transitions
  // =========================================================================
  describe('Item Operations vs State Transitions', () => {
    it('blocks item addition if order was billed right before item transaction commits', async () => {
      const orderStore: PosOrder[] = [{
        id: 'ord-race-1',
        branchId: 'br-1',
        status: 'billed', // Order transitioned to billed by cashier
        openedBy: 'u_mgr',
        items: [],
        date: '2026-10-19',
        createdAt: '2026-10-19T10:00:00Z',
        updatedAt: '2026-10-19T10:00:00Z',
      }]

      dbMocks.withTransaction.mockImplementation(async (file: string, callback: (items: PosOrder[]) => PosOrder[]) => {
        callback(orderStore)
        return true
      })

      const res = await addOrUpdateOrderItem('ord-race-1', 'm1', 1, 100, 'Dosa')
      expect(res.error).toBe('Order is not open')
    })

    it('blocks item addition if order was voided right before item transaction commits', async () => {
      const orderStore: PosOrder[] = [{
        id: 'ord-race-2',
        branchId: 'br-1',
        status: 'voided', // Order voided by manager
        openedBy: 'u_mgr',
        items: [],
        date: '2026-10-19',
        createdAt: '2026-10-19T10:00:00Z',
        updatedAt: '2026-10-19T10:00:00Z',
      }]

      dbMocks.withTransaction.mockImplementation(async (file: string, callback: (items: PosOrder[]) => PosOrder[]) => {
        callback(orderStore)
        return true
      })

      const res = await addOrUpdateOrderItem('ord-race-2', 'm1', 1, 100, 'Dosa')
      expect(res.error).toBe('Order is not open')
    })
  })

  // =========================================================================
  // 4. Concurrent Bill Generation (Idempotency)
  // =========================================================================
  describe('Concurrent Bill Generation', () => {
    it('second concurrent bill generation call is idempotent and succeeds without error', async () => {
      const orderStore: PosOrder[] = [{
        id: 'ord-bill-race',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [{ id: 'i1', menuItemId: 'm1', quantity: 2, unitPrice: 100 }],
        date: '2026-10-19',
        createdAt: '2026-10-19T10:00:00Z',
        updatedAt: '2026-10-19T10:00:00Z',
      }]

      dbMocks.withTransaction.mockImplementation(async (file: string, callback: (items: PosOrder[]) => PosOrder[]) => {
        callback(orderStore)
        return true
      })

      const fd1 = new FormData()
      fd1.set('orderId', 'ord-bill-race')
      fd1.set('discount', '0')
      fd1.set('gst', '10')

      const fd2 = new FormData()
      fd2.set('orderId', 'ord-bill-race')
      fd2.set('discount', '0')
      fd2.set('gst', '10')

      const res1 = await generateBill(null, fd1)
      expect(res1.success).toBe(true)

      // Second concurrent submission finds order.status === 'billed' -> returns { success: true }
      const res2 = await generateBill(null, fd2)
      expect(res2.success).toBe(true)
    })
  })

  // =========================================================================
  // 5. Concurrent Payment & Settlement
  // =========================================================================
  describe('Concurrent Payment & Settlement', () => {
    it('blocks duplicate payment when two cashiers click complete payment concurrently', async () => {
      const orderStore: PosOrder[] = [{
        id: 'ord-pay-race',
        branchId: 'br-1',
        status: 'billed',
        openedBy: 'u_mgr',
        items: [{ id: 'i1', menuItemId: 'm1', quantity: 1, unitPrice: 200 }],
        bill: { subtotal: 200, discount: 0, gst: 10, totalPayable: 210, generatedAt: '2026-10-19T10:00:00Z' },
        date: '2026-10-19',
        createdAt: '2026-10-19T10:00:00Z',
        updatedAt: '2026-10-19T10:00:00Z',
      }]

      dbMocks.withTransaction.mockImplementation(async (file: string, callback: (items: PosOrder[]) => PosOrder[]) => {
        callback(orderStore)
        return true
      })

      const fd1 = new FormData()
      fd1.set('orderId', 'ord-pay-race')
      fd1.set('method', 'cash')

      const fd2 = new FormData()
      fd2.set('orderId', 'ord-pay-race')
      fd2.set('method', 'cash')

      const res1 = await recordPayment(null, fd1)
      expect(res1.success).toBe(true)

      // Once paid, second payment attempt must fail
      const res2 = await recordPayment(null, fd2)
      expect(res2.error).toBe('Order must be billed before payment')
    })

    it('blocks reopen if order was settled by cashier during reopen initiation', async () => {
      const orderStore: PosOrder[] = [{
        id: 'ord-reopen-race',
        branchId: 'br-1',
        status: 'paid', // Cashier settled it first
        openedBy: 'u_mgr',
        items: [],
        date: '2026-10-19',
        createdAt: '2026-10-19T10:00:00Z',
        updatedAt: '2026-10-19T10:00:00Z',
      }]

      dbMocks.withTransaction.mockImplementation(async (file: string, callback: (items: PosOrder[]) => PosOrder[]) => {
        callback(orderStore)
        return true
      })

      const res = await reopenOrder('ord-reopen-race')
      expect(res.error).toBe('A paid order cannot be reopened')
    })
  })

  // =========================================================================
  // 6. Transaction Failures & Lock Rollbacks
  // =========================================================================
  describe('Transaction Failures & Lock Rollbacks', () => {
    it('returns "Transaction failed" when withTransaction fails on createTable', async () => {
      dbMocks.withTransaction.mockResolvedValue(false) // Lock failure / write timeout

      const fd = new FormData()
      fd.set('name', 'Table 1')
      fd.set('branchId', 'br-1')

      const res = await createTable(null, fd)
      expect(res.error).toBe('Transaction failed')
    })

    it('returns "Transaction failed" when withTransaction fails on createOrder', async () => {
      dbMocks.withTransaction.mockResolvedValue(false)

      const fd = new FormData()
      fd.set('orderType', 'dine-in')
      fd.set('tableId', 'tbl-1')
      fd.set('branchId', 'br-1')
      fd.set('covers', '2')

      const res = await createOrder(null, fd)
      expect(res.error).toBe('Transaction failed')
    })

    it('returns "Transaction failed" when withTransaction fails on fireKot', async () => {
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.POS_ORDERS) {
          return [{
            id: 'ord-1',
            branchId: 'br-1',
            status: 'open',
            openedBy: 'u_mgr',
            items: [{ menuItemId: 'm1', quantity: 1, nameSnapshot: 'Thali' }],
          }]
        }
        return []
      })
      dbMocks.withTransaction.mockResolvedValue(false)

      const res = await fireKot('ord-1')
      expect(res.error).toBe('Transaction failed')
    })

    it('returns "Transaction failed" when withTransaction fails on generateBill', async () => {
      dbMocks.withTransaction.mockResolvedValue(false)

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('discount', '0')
      fd.set('gst', '0')

      const res = await generateBill(null, fd)
      expect(res.error).toBe('Transaction failed')
    })

    it('returns "Transaction failed" when withTransaction fails on recordPayment', async () => {
      dbMocks.withTransaction.mockResolvedValue(false)

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('method', 'cash')

      const res = await recordPayment(null, fd)
      expect(res.error).toBe('Transaction failed')
    })

    it('returns "Transaction failed" when withTransaction fails on voidOrder', async () => {
      dbMocks.withTransaction.mockResolvedValue(false)

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('reason', 'Test void')

      const res = await voidOrder(null, fd)
      expect(res.error).toBe('Transaction failed')
    })
  })
})
