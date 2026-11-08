import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createTable,
  renameTable,
  deactivateTable,
  createOrder,
  addOrUpdateOrderItem,
  removeOrderItem,
  updateOrderNote,
  fireKot,
  generateBill,
  reopenOrder,
  recordPayment,
  voidOrder,
  advanceKotStatus,
} from '@/app/actions/pos'

// Mocks
const { authMocks, auditMocks, mockDb, mockWithDbTransaction } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state: any = {
    tables: [] as any[],
    orders: [] as any[],
    kots: [] as any[],
    users: [] as any[],
    failNext: false,
    lastTxOptions: null as any,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCollection = (tableName?: string): any[] => {
    if (tableName === 'pos_tables') return state.tables
    if (tableName === 'pos_orders') return state.orders
    if (tableName === 'pos_kots') return state.kots
    if (tableName === 'users') return state.users
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filterItem = (tableName: string, item: any, str: string): boolean => {
    if (str.includes('<>') && str.includes(`"${item.id}"`)) return false

    if (tableName === 'pos_tables') {
      if (str.includes('"br-1"') && item.branchId !== 'br-1') return false
      if (!str.includes('<>')) {
        if (str.includes('"ptbl_1"') && item.id !== 'ptbl_1') return false
        if (str.includes('"ptbl_2"') && item.id !== 'ptbl_2') return false
        if (str.includes('"tbl-1"') && item.id !== 'tbl-1') return false
        if (str.includes('"tbl-missing"') && item.id !== 'tbl-missing') return false
      }
      if (str.includes('"is_active"') && str.includes('true') && !item.isActive) return false
      if (str.includes('"deleted_at"') && item.deletedAt) return false
      if (str.toLowerCase().includes('"table 2"') && item.name?.toLowerCase() !== 'table 2') return false
      if (str.toLowerCase().includes('"patio 1"') && item.name?.toLowerCase() !== 'patio 1') return false
      return true
    }

    if (tableName === 'pos_orders') {
      if (str.includes('"open"') && item.status !== 'open') return false
      if (str.includes('"billed"') && item.status !== 'billed') return false
      if (str.includes('"paid"') && item.status !== 'paid') return false
      if (str.includes('"voided"') && str.includes('<>') && item.status === 'voided') return false
      if (str.includes('"tbl-1"') && item.tableId !== 'tbl-1') return false
      if (str.includes('"takeaway"') && item.orderType !== 'takeaway') return false
      if (!str.includes('<>')) {
        if (str.includes('"ord-1"') && item.id !== 'ord-1') return false
        if (str.includes('"ord-t1"') && item.id !== 'ord-t1') return false
        if (str.includes('"ord-t2"') && item.id !== 'ord-t2') return false
        if (str.includes('"ord-t3"') && item.id !== 'ord-t3') return false
      }
      return true
    }

    if (tableName === 'pos_kots') {
      if (str.includes('"ord-1"') && item.orderId !== 'ord-1') return false
      if (str.includes('"kot-1"') && item.id !== 'kot-1') return false
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

  return {
    authMocks: {
      getSession: vi.fn(),
      requireBranchAccess: vi.fn(),
    },
    auditMocks: {
      logAction: vi.fn(),
    },
    mockDb: mock,
    mockWithDbTransaction: mockTx,
  }
})

vi.mock('@/app/actions/auth', () => ({
  getSession: authMocks.getSession,
  requireBranchAccess: authMocks.requireBranchAccess,
}))

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
    date: { name: 'date' },
    openedBy: { name: 'opened_by' },
    bill: { name: 'bill' },
    payment: { name: 'payment' },
    void: { name: 'void' },
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
  menuItems: {
    tableName: 'menu_items',
    id: { name: 'id' },
    isActive: { name: 'is_active' },
    deletedAt: { name: 'deleted_at' },
  },
  menuCategories: {
    tableName: 'menu_categories',
    id: { name: 'id' },
    name: { name: 'name' },
    deletedAt: { name: 'deleted_at' },
  },
  branchMenuItems: {
    tableName: 'branch_menu_items',
    branchId: { name: 'branch_id' },
  },
  users: {
    tableName: 'users',
    id: { name: 'id' },
  },
  readBranchMenuItems: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/audit', () => ({
  logAction: auditMocks.logAction,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('POS Actions Comprehensive Suite - posActionsComprehensive.test.ts', () => {
  const managerSession = { userId: 'u_mgr', name: 'Manager Bob', role: 'manager', isGlobalAdmin: false, branchId: 'br-1' }
  const adminSession = { userId: 'u_admin', name: 'Admin Alice', role: 'admin', isGlobalAdmin: true }
  const waiterSession = { userId: 'u_waiter', name: 'Waiter Dave', role: 'waiter', isGlobalAdmin: false, branchId: 'br-1' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.state.tables = []
    mockDb.state.orders = []
    mockDb.state.kots = []
    mockDb.state.users = []
    mockDb.state.failNext = false
    mockDb.state.lastTxOptions = null

    authMocks.getSession.mockResolvedValue(managerSession)
    authMocks.requireBranchAccess.mockImplementation(async (bId?: string) => bId || 'br-1')
    auditMocks.logAction.mockResolvedValue(undefined)
  })

  // =========================================================================
  // Table Management
  // =========================================================================
  describe('createTable', () => {
    it('rejects table name longer than 50 characters', async () => {
      const fd = new FormData()
      fd.set('name', 'A'.repeat(51))
      fd.set('branchId', 'br-1')

      const res = await createTable(null, fd)
      expect(res.error).toBe('Table name must be at most 50 characters')
    })

    it('rejects empty or whitespace-only table name', async () => {
      const fd = new FormData()
      fd.set('name', '   ')
      fd.set('branchId', 'br-1')

      const res = await createTable(null, fd)
      expect(res.error).toBe('Table name is required')
    })

    it('rejects duplicate table name case-insensitively and trimmed', async () => {
      mockDb.state.tables = [
        { id: 'ptbl_1', branchId: 'br-1', name: 'Patio 1', isActive: true, deletedAt: null },
      ]

      const fd = new FormData()
      fd.set('name', '  patio 1  ')
      fd.set('branchId', 'br-1')

      const res = await createTable(null, fd)
      expect(res.error).toBe('A table with this name already exists')
    })

    it('enforces active table limit of 50 tables per branch', async () => {
      mockDb.state.tables = Array.from({ length: 50 }, (_, i) => ({
        id: `ptbl_${i}`,
        branchId: 'br-1',
        name: `Table ${i + 1}`,
        isActive: true,
        deletedAt: null,
      }))

      const fd = new FormData()
      fd.set('name', 'Table 51')
      fd.set('branchId', 'br-1')

      const res = await createTable(null, fd)
      expect(res.error).toBe('Active table limit (50) reached')
    })
  })

  describe('renameTable', () => {
    it('rejects renaming to an existing active table name', async () => {
      mockDb.state.tables = [
        { id: 'ptbl_1', branchId: 'br-1', name: 'Table 1', isActive: true, deletedAt: null },
        { id: 'ptbl_2', branchId: 'br-1', name: 'Table 2', isActive: true, deletedAt: null },
      ]

      const fd = new FormData()
      fd.set('tableId', 'ptbl_1')
      fd.set('newName', 'table 2')
      fd.set('branchId', 'br-1')

      const res = await renameTable(null, fd)
      expect(res.error).toBe('A table with this name already exists')
    })

    it('returns error if table to rename does not exist in branch', async () => {
      mockDb.state.tables = []

      const fd = new FormData()
      fd.set('tableId', 'nonexistent_id')
      fd.set('newName', 'New Name')
      fd.set('branchId', 'br-1')

      const res = await renameTable(null, fd)
      expect(res.error).toBe('Table not found')
    })
  })

  describe('deactivateTable', () => {
    it('rejects deactivating a table that has an active open order', async () => {
      mockDb.state.tables = [{ id: 'tbl-1', branchId: 'br-1', isActive: true, deletedAt: null }]
      mockDb.state.orders = [{ id: 'ord-1', branchId: 'br-1', tableId: 'tbl-1', status: 'open' }]

      const res = await deactivateTable('tbl-1')
      expect(res.error).toBe('Table has an active open order and cannot be deactivated')
    })

    it('returns error if table is not found', async () => {
      mockDb.state.tables = []
      const res = await deactivateTable('tbl-missing')
      expect(res.error).toBe('Table not found')
    })
  })

  // =========================================================================
  // Order Operations
  // =========================================================================
  describe('createOrder', () => {
    it('rejects covers less than 1 or greater than 30', async () => {
      const fd = new FormData()
      fd.set('orderType', 'dine-in')
      fd.set('tableId', 'tbl-1')
      fd.set('branchId', 'br-1')
      fd.set('covers', '-1')

      const resLow = await createOrder(null, fd)
      expect(resLow.error).toBeDefined()

      fd.set('covers', '31')
      const resHigh = await createOrder(null, fd)
      expect(resHigh.error).toBeDefined()
    })

    it('rejects dine-in order without a tableId', async () => {
      const fd = new FormData()
      fd.set('orderType', 'dine-in')
      fd.set('branchId', 'br-1')
      fd.set('covers', '2')

      const res = await createOrder(null, fd)
      expect(res.error).toBe('Table is required for dine-in orders')
    })

    it('rejects takeaway order with a tableId assigned', async () => {
      const fd = new FormData()
      fd.set('orderType', 'takeaway')
      fd.set('tableId', 'tbl-1')
      fd.set('branchId', 'br-1')

      const res = await createOrder(null, fd)
      expect(res.error).toBe('Takeaway orders must not have a table assigned')
    })

    it('rejects creating dine-in order if table already has open order', async () => {
      mockDb.state.orders = [{ id: 'ord-1', branchId: 'br-1', tableId: 'tbl-1', status: 'open' }]

      const fd = new FormData()
      fd.set('orderType', 'dine-in')
      fd.set('tableId', 'tbl-1')
      fd.set('branchId', 'br-1')
      fd.set('covers', '2')

      const res = await createOrder(null, fd)
      expect(res.error).toBe('Table already has an open order')
    })

    it('auto-increments takeawayNumber skipping voided orders', async () => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      mockDb.state.orders = [
        { id: 'ord-t1', branchId: 'br-1', date: today, orderType: 'takeaway', status: 'open' },
        { id: 'ord-t2', branchId: 'br-1', date: today, orderType: 'takeaway', status: 'voided' }, // should be excluded
        { id: 'ord-t3', branchId: 'br-1', date: today, orderType: 'takeaway', status: 'paid' },
      ]

      const fd = new FormData()
      fd.set('orderType', 'takeaway')
      fd.set('branchId', 'br-1')

      const res = await createOrder(null, fd)
      expect(res.success).toBe(true)
      // Non-voided today takeaways count = 2 ('ord-t1', 'ord-t3'), so next is T-3
      const created = mockDb.state.orders[mockDb.state.orders.length - 1]
      expect(created?.takeawayNumber).toBe('T-3')
    })
  })

  // =========================================================================
  // Cart & Item Operations
  // =========================================================================
  describe('addOrUpdateOrderItem', () => {
    it('rejects quantity < 1 or quantity > 99', async () => {
      const res0 = await addOrUpdateOrderItem('ord-1', 'm1', 0, 100, 'Naan')
      expect(res0.error).toBeDefined()

      const res100 = await addOrUpdateOrderItem('ord-1', 'm1', 100, 100, 'Naan')
      expect(res100.error).toBeDefined()
    })

    it('rejects item note longer than 80 characters', async () => {
      const res = await addOrUpdateOrderItem('ord-1', 'm1', 1, 100, 'Naan', undefined, 'A'.repeat(81))
      expect(res.error).toBeDefined()
    })

    it('rejects negative unit price', async () => {
      const res = await addOrUpdateOrderItem('ord-1', 'm1', 1, -50, 'Naan')
      expect(res.error).toBeDefined()
    })

    it('returns error if order is not in open status', async () => {
      mockDb.state.orders = [{ id: 'ord-1', branchId: 'br-1', status: 'billed', items: [], openedBy: 'u_mgr' }]

      const res = await addOrUpdateOrderItem('ord-1', 'm1', 1, 100, 'Naan')
      expect(res.error).toBe('Order is not open')
    })

    it('updates existing item quantity and note while keeping original unit price immutable', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [{ id: 'it-1', menuItemId: 'm1', quantity: 2, unitPrice: 150, nameSnapshot: 'Thali' }],
      }]

      const res = await addOrUpdateOrderItem('ord-1', 'm1', 4, 999, 'Thali', undefined, 'Extra spicy')
      expect(res.success).toBe(true)
      const item = mockDb.state.orders[0].items[0]
      expect(item.quantity).toBe(4)
      expect(item.unitPrice).toBe(150) // Remains 150, ignoring 999
      expect(item.note).toBe('Extra spicy')
    })

    it('waiter cannot edit order opened by another user', async () => {
      authMocks.getSession.mockResolvedValue(waiterSession)
      mockDb.state.orders = [{ id: 'ord-1', branchId: 'br-1', status: 'open', openedBy: 'u_other_waiter', items: [] }]

      const res = await addOrUpdateOrderItem('ord-1', 'm1', 1, 100, 'Naan')
      expect(res.error).toBe('Forbidden: waiters can only edit their own orders')
    })
  })

  describe('removeOrderItem', () => {
    it('returns error if item does not exist in order', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [{ id: 'it-1', menuItemId: 'm1', quantity: 1, unitPrice: 100 }],
      }]

      const res = await removeOrderItem('ord-1', 'it-nonexistent')
      expect(res.error).toBe('Order item not found')
    })
  })

  describe('updateOrderNote', () => {
    it('rejects note exceeding 200 characters', async () => {
      const res = await updateOrderNote('ord-1', 'A'.repeat(201))
      expect(res.error).toBe('Note must be at most 200 characters')
    })

    it('clears note to null/falsy when empty string is provided', async () => {
      mockDb.state.orders = [{ id: 'ord-1', branchId: 'br-1', status: 'open', openedBy: 'u_mgr', note: 'Existing note' }]

      const res = await updateOrderNote('ord-1', '')
      expect(res.success).toBe(true)
      expect(mockDb.state.orders[0].note).toBeFalsy()
    })
  })

  // =========================================================================
  // KOT Operations
  // =========================================================================
  describe('fireKot', () => {
    it('rejects firing KOT on an empty order', async () => {
      mockDb.state.orders = [{ id: 'ord-1', branchId: 'br-1', status: 'open', items: [], openedBy: 'u_mgr' }]

      const res = await fireKot('ord-1')
      expect(res.error).toBe('Order has no items')
    })

    it('rejects firing KOT when all items have already been fired in prior KOTs', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [{ menuItemId: 'm1', quantity: 2, nameSnapshot: 'Paneer' }],
      }]
      mockDb.state.kots = [{
        id: 'kot-1',
        orderId: 'ord-1',
        branchId: 'br-1',
        items: [{ menuItemId: 'm1', quantity: 2 }],
      }]

      const res = await fireKot('ord-1')
      expect(res.error).toBe('No new items to send to kitchen')
    })

    it('computes positive delta when item quantity is incremented', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [{ menuItemId: 'm1', quantity: 5, nameSnapshot: 'Paneer' }],
        kotCount: 1,
      }]
      mockDb.state.kots = [{
        id: 'kot-1',
        orderId: 'ord-1',
        branchId: 'br-1',
        kotNumber: 1,
        items: [{ menuItemId: 'm1', quantity: 2 }],
      }]

      const res = await fireKot('ord-1')
      expect(res.success).toBe(true)
      const createdKot = mockDb.state.kots[mockDb.state.kots.length - 1]
      expect(createdKot?.kotNumber).toBe(2)
      expect(createdKot?.items[0].quantity).toBe(3) // 5 - 2 = 3
      expect(createdKot?.status).toBe('pending')
    })
  })

  // =========================================================================
  // Bill Generation & Reopen
  // =========================================================================
  describe('generateBill', () => {
    it('rejects discount that exceeds order subtotal', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        items: [{ id: 'it-1', quantity: 1, unitPrice: 200 }],
      }]

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('discount', '250') // Exceeds 200
      fd.set('gst', '0')

      const res = await generateBill(null, fd)
      expect(res.error).toBe('Discount cannot exceed the subtotal')
    })

    it('requires confirmation if total payable is zero', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        items: [{ id: 'it-1', quantity: 1, unitPrice: 200 }],
      }]

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('discount', '200') // 100% discount
      fd.set('gst', '0')

      const res = await generateBill(null, fd)
      expect(res.error).toBe('ZERO_BILL_CONFIRM_REQUIRED')

      // Now with confirmed flag = true
      fd.set('confirmed', 'true')
      const resConfirmed = await generateBill(null, fd)
      expect(resConfirmed.success).toBe(true)
      expect(mockDb.state.orders[0].bill?.totalPayable).toBe(0)
    })

    it('is idempotent if order is already billed', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'billed',
        items: [{ id: 'it-1', quantity: 1, unitPrice: 200 }],
      }]

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('discount', '0')
      fd.set('gst', '10')

      const res = await generateBill(null, fd)
      expect(res.success).toBe(true)
    })
  })

  describe('reopenOrder', () => {
    it('rejects reopening a paid order', async () => {
      mockDb.state.orders = [{ id: 'ord-1', branchId: 'br-1', status: 'paid' }]

      const res = await reopenOrder('ord-1')
      expect(res.error).toBe('A paid order cannot be reopened')
    })

    it('rejects reopening an open or voided order', async () => {
      mockDb.state.orders = [{ id: 'ord-1', branchId: 'br-1', status: 'open' }]

      const res = await reopenOrder('ord-1')
      expect(res.error).toBe('Only billed orders can be reopened')
    })

    it('successfully resets billed order to open and clears bill object', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'billed',
        bill: { subtotal: 100, totalPayable: 100 },
      }]

      const res = await reopenOrder('ord-1')
      expect(res.success).toBe(true)
      expect(mockDb.state.orders[0].status).toBe('open')
      expect(mockDb.state.orders[0].bill).toBeFalsy()
    })
  })

  // =========================================================================
  // Settlement & Payment
  // =========================================================================
  describe('recordPayment', () => {
    it('rejects payment if order is not in billed status', async () => {
      mockDb.state.orders = [{ id: 'ord-1', branchId: 'br-1', status: 'open' }]

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('method', 'cash')

      const res = await recordPayment(null, fd)
      expect(res.error).toBe('Order must be billed before payment')
    })

    it('rejects split payment if cash + upi does not balance with total payable', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'billed',
        bill: { totalPayable: 500 },
      }]

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('method', 'split')
      fd.set('cashAmount', '300')
      fd.set('upiAmount', '100') // Total = 400 != 500

      const res = await recordPayment(null, fd)
      expect(res.error).toBe('Payment amounts do not balance with total payable')
    })

    it('computes changeDue accurately when cashTendered exceeds cashAmount', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'billed',
        bill: { totalPayable: 350 },
      }]

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('method', 'cash')
      fd.set('cashTendered', '500')

      const res = await recordPayment(null, fd)
      expect(res.success).toBe(true)
      expect(res.changeDue).toBe(150) // 500 - 350 = 150
    })
  })

  // =========================================================================
  // Voiding & KOT Advancement
  // =========================================================================
  describe('voidOrder', () => {
    it('rejects voiding without a reason', async () => {
      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('reason', '   ')

      const res = await voidOrder(null, fd)
      expect(res.error).toBe('Void reason is required')
    })

    it('non-global-admin cannot void a paid order', async () => {
      authMocks.getSession.mockResolvedValue(managerSession) // Not global admin
      mockDb.state.orders = [{ id: 'ord-1', branchId: 'br-1', status: 'paid', payment: { paidAt: new Date().toISOString() } }]

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('reason', 'Customer requested refund')

      const res = await voidOrder(null, fd)
      expect(res.error).toBe('Forbidden')
    })

    it('global admin can void a paid order on the same calendar day', async () => {
      authMocks.getSession.mockResolvedValue(adminSession) // Global admin
      mockDb.state.orders = [{ id: 'ord-1', branchId: 'br-1', status: 'paid', payment: { paidAt: new Date().toISOString() } }]

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('reason', 'Accidental double charge')

      const res = await voidOrder(null, fd)
      expect(res.success).toBe(true)
      expect(mockDb.state.orders[0].status).toBe('voided')
      expect(mockDb.state.orders[0].void?.reason).toBe('Accidental double charge')
    })
  })

  describe('advanceKotStatus', () => {
    it('advances KOT sequentially through pending -> preparing -> ready -> served', async () => {
      mockDb.state.kots = [{ id: 'kot-1', branchId: 'br-1', status: 'pending' }]

      await advanceKotStatus('kot-1')
      expect(mockDb.state.kots[0].status).toBe('preparing')

      await advanceKotStatus('kot-1')
      expect(mockDb.state.kots[0].status).toBe('ready')

      await advanceKotStatus('kot-1')
      expect(mockDb.state.kots[0].status).toBe('served')
    })

    it('rejects advancing a KOT that is already served', async () => {
      mockDb.state.kots = [{ id: 'kot-1', branchId: 'br-1', status: 'served' }]

      const res = await advanceKotStatus('kot-1')
      expect(res.error).toBe('KOT is already served')
    })
  })
})
