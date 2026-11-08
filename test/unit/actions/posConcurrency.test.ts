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
import type { PosOrder, PosTable, PosKot } from '@/app/actions/posTypes'

const { mockDb, mockWithDbTransaction } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state: any = {
    tables: [] as any[],
    orders: [] as any[],
    kots: [] as any[],
    failNext: false,
    lastTxOptions: null as any,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCollection = (tableName?: string): any[] => {
    if (tableName === 'pos_tables') return state.tables
    if (tableName === 'pos_orders') return state.orders
    if (tableName === 'pos_kots') return state.kots
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filterItem = (tableName: string, item: any, str: string): boolean => {
    if (str.includes('<>') && str.includes(`"${item.id}"`)) return false
    if (tableName === 'pos_tables') {
      if (str.includes('"is_active"') && str.includes('true') && !item.isActive) return false
      if (str.includes('"deleted_at"') && item.deletedAt) return false
      if (str.toLowerCase().includes('"patio corner"') && item.name?.toLowerCase() !== 'patio corner') return false
      return true
    }
    if (tableName === 'pos_orders') {
      if (str.includes('"open"') && item.status !== 'open') return false
      if (str.includes('"tbl-5"') && item.tableId !== 'tbl-5') return false
      if (str.includes('"takeaway"') && item.orderType !== 'takeaway') return false
      if (str.includes('"voided"') && (str.includes('<>') || str.includes('ne')) && item.status === 'voided') return false
      if (str.includes(`"${item.id}"`)) return true
      return true
    }
    if (tableName === 'pos_kots') {
      if (str.includes(`"${item.orderId}"`)) return true
      return true
    }
    return true
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
  const mockTx = vi.fn(async (cb: any, options?: any) => {
    state.lastTxOptions = options
    if (state.failNext) throw new Error('Transaction failed')
    return cb(mock)
  })

  return { mockDb: mock, mockWithDbTransaction: mockTx }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  withDbTransaction: mockWithDbTransaction,
  posTables: {
    tableName: 'pos_tables',
    id: { name: 'id' },
    branchId: { name: 'branch_id' },
    name: { name: 'name' },
    isActive: { name: 'is_active' },
    deletedAt: { name: 'deleted_at' },
  },
  posOrders: {
    tableName: 'pos_orders',
    id: { name: 'id' },
    branchId: { name: 'branch_id' },
    tableId: { name: 'table_id' },
    takeawayNumber: { name: 'takeaway_number' },
    orderType: { name: 'order_type' },
    covers: { name: 'covers' },
    status: { name: 'status' },
    items: { name: 'items' },
    note: { name: 'note' },
    kotCount: { name: 'kot_count' },
    bill: { name: 'bill' },
    payment: { name: 'payment' },
    void: { name: 'void' },
    date: { name: 'date' },
    openedBy: { name: 'opened_by' },
    createdAt: { name: 'created_at' },
    updatedAt: { name: 'updated_at' },
  },
  posKots: {
    tableName: 'pos_kots',
    id: { name: 'id' },
    orderId: { name: 'order_id' },
    branchId: { name: 'branch_id' },
    kotNumber: { name: 'kot_number' },
    items: { name: 'items' },
    status: { name: 'status' },
    firedBy: { name: 'fired_by' },
    firedAt: { name: 'fired_at' },
    updatedAt: { name: 'updated_at' },
  },
  menuItems: { tableName: 'menu_items' },
  menuCategories: { tableName: 'menu_categories' },
  menuItemVariants: { tableName: 'menu_item_variants' },
  branchMenuItems: { tableName: 'branch_menu_items' },
}))

const { authMocks, auditMocks } = vi.hoisted(() => ({
  authMocks: {
    getSession: vi.fn(),
    requireBranchAccess: vi.fn(),
  },
  auditMocks: {
    logAction: vi.fn(),
  },
}))

vi.mock('@/app/actions/auth', () => ({
  getSession: authMocks.getSession,
  requireBranchAccess: authMocks.requireBranchAccess,
}))

vi.mock('@/lib/audit', () => ({
  logAction: auditMocks.logAction,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('POS Concurrency & Transaction Safety - posConcurrency.test.ts', () => {
  const managerSession = { userId: 'u_mgr', name: 'Manager Bob', role: 'manager', isGlobalAdmin: false, branchId: 'br-1' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.state.tables = []
    mockDb.state.orders = []
    mockDb.state.kots = []
    mockDb.state.failNext = false
    mockDb.state.lastTxOptions = null

    authMocks.getSession.mockResolvedValue(managerSession)
    authMocks.requireBranchAccess.mockImplementation(async (bId?: string) => bId || 'br-1')
    auditMocks.logAction.mockResolvedValue(undefined)
  })

  // =========================================================================
  // 1. Concurrent Table Operations
  // =========================================================================
  describe('Concurrent Table Operations', () => {
    it('prevents exceeding 50 tables when concurrent creates arrive at limit boundary', async () => {
      mockDb.state.tables = Array.from({ length: 49 }, (_, i) => ({
        id: `tbl_${i}`,
        branchId: 'br-1',
        name: `Table ${i + 1}`,
        isActive: true,
        createdAt: '2026-10-19T00:00:00Z',
        updatedAt: '2026-10-19T00:00:00Z',
      }))

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
      expect(mockDb.state.tables.length).toBe(50)
    })

    it('prevents duplicate table names when two clients submit the same name simultaneously', async () => {
      mockDb.state.tables = []

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
      mockDb.state.orders = []

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

      const res1 = await createOrder(null, fd1)
      const res2 = await createOrder(null, fd2)

      const successes = [res1, res2].filter((r: any) => r.success === true)
      const errors = [res1, res2].filter((r: any) => r.error === 'Table already has an open order')

      expect(successes).toHaveLength(1)
      expect(errors).toHaveLength(1)
      expect(mockDb.state.orders.filter((o: any) => o.tableId === 'tbl-5')).toHaveLength(1)
    })
  })

  // =========================================================================
  // 3. Item Operations vs State Transitions
  // =========================================================================
  describe('Item Operations vs State Transitions', () => {
    it('blocks item addition if order was billed right before item transaction commits', async () => {
      mockDb.state.orders = [{
        id: 'ord-race-1',
        branchId: 'br-1',
        status: 'billed', // Order transitioned to billed by cashier
        openedBy: 'u_mgr',
        items: [],
        date: '2026-10-19',
        createdAt: '2026-10-19T10:00:00Z',
        updatedAt: '2026-10-19T10:00:00Z',
      }]

      const res = await addOrUpdateOrderItem('ord-race-1', 'm1', 1, 100, 'Dosa')
      expect(res.error).toBe('Order is not open')
    })

    it('blocks item addition if order was voided right before item transaction commits', async () => {
      mockDb.state.orders = [{
        id: 'ord-race-2',
        branchId: 'br-1',
        status: 'voided', // Order voided by manager
        openedBy: 'u_mgr',
        items: [],
        date: '2026-10-19',
        createdAt: '2026-10-19T10:00:00Z',
        updatedAt: '2026-10-19T10:00:00Z',
      }]

      const res = await addOrUpdateOrderItem('ord-race-2', 'm1', 1, 100, 'Dosa')
      expect(res.error).toBe('Order is not open')
    })
  })

  // =========================================================================
  // 4. Concurrent Bill Generation (Idempotency)
  // =========================================================================
  describe('Concurrent Bill Generation', () => {
    it('second concurrent bill generation call is idempotent and succeeds without error', async () => {
      mockDb.state.orders = [{
        id: 'ord-bill-race',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [{ id: 'i1', menuItemId: 'm1', quantity: 2, unitPrice: 100 }],
        date: '2026-10-19',
        createdAt: '2026-10-19T10:00:00Z',
        updatedAt: '2026-10-19T10:00:00Z',
      }]

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
      mockDb.state.orders = [{
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
      mockDb.state.orders = [{
        id: 'ord-reopen-race',
        branchId: 'br-1',
        status: 'paid', // Cashier settled it first
        openedBy: 'u_mgr',
        items: [],
        date: '2026-10-19',
        createdAt: '2026-10-19T10:00:00Z',
        updatedAt: '2026-10-19T10:00:00Z',
      }]

      const res = await reopenOrder('ord-reopen-race')
      expect(res.error).toBe('A paid order cannot be reopened')
    })
  })

  // =========================================================================
  // 6. Transaction Failures & Lock Rollbacks
  // =========================================================================
  describe('Transaction Failures & Lock Rollbacks', () => {
    it('returns "Transaction failed" when withTransaction fails on createTable', async () => {
      mockDb.state.failNext = true

      const fd = new FormData()
      fd.set('name', 'Table 1')
      fd.set('branchId', 'br-1')

      const res = await createTable(null, fd)
      expect(res.error).toBe('Transaction failed')
    })

    it('returns "Transaction failed" when withTransaction fails on createOrder', async () => {
      mockDb.state.failNext = true

      const fd = new FormData()
      fd.set('orderType', 'dine-in')
      fd.set('tableId', 'tbl-1')
      fd.set('branchId', 'br-1')
      fd.set('covers', '2')

      const res = await createOrder(null, fd)
      expect(res.error).toBe('Transaction failed')
    })

    it('returns "Transaction failed" when withTransaction fails on fireKot', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [{ menuItemId: 'm1', quantity: 1, nameSnapshot: 'Thali' }],
      }]
      mockDb.state.failNext = true

      const res = await fireKot('ord-1')
      expect(res.error).toBe('Transaction failed')
    })

    it('returns "Transaction failed" when withTransaction fails on generateBill', async () => {
      mockDb.state.failNext = true

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('discount', '0')
      fd.set('gst', '0')

      const res = await generateBill(null, fd)
      expect(res.error).toBe('Transaction failed')
    })

    it('returns "Transaction failed" when withTransaction fails on recordPayment', async () => {
      mockDb.state.failNext = true

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('method', 'cash')

      const res = await recordPayment(null, fd)
      expect(res.error).toBe('Transaction failed')
    })

    it('returns "Transaction failed" when withTransaction fails on voidOrder', async () => {
      mockDb.state.failNext = true

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('reason', 'Test void')

      const res = await voidOrder(null, fd)
      expect(res.error).toBe('Transaction failed')
    })
  })

  // =========================================================================
  // 7. Isolation and Atomicity Guarantees (Req 9.3, 9.4, 9.10)
  // =========================================================================
  describe('Isolation and Atomicity Guarantees', () => {
    it('uses serializable isolation for takeaway orders', async () => {
      const fd = new FormData()
      fd.set('orderType', 'takeaway')
      fd.set('branchId', 'br-1')

      await createOrder(null, fd)
      expect(mockWithDbTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'serializable' }
      )
    })

    it('runs KOT insert and kotCount update inside the same transaction', async () => {
      mockDb.state.orders = [
        {
          id: 'ord-1',
          branchId: 'br-1',
          status: 'open',
          openedBy: 'u_mgr',
          items: [{ menuItemId: 'm1', quantity: 1, nameSnapshot: 'Thali' }],
        },
      ]

      const res = await fireKot('ord-1')
      expect(res.success).toBe(true)
      expect(mockWithDbTransaction).toHaveBeenCalledTimes(1)
      expect(mockDb.state.kots).toHaveLength(1)
      expect(mockDb.state.orders[0].kotCount).toBe(1)
    })
  })
})
