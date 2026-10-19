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
import { DB_FILES } from '@/lib/db'

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
      const existingTables = [
        { id: 'ptbl_1', branchId: 'br-1', name: 'Patio 1', isActive: true },
      ]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...existingTables]
        callback(copy)
        return true
      })

      const fd = new FormData()
      fd.set('name', '  patio 1  ')
      fd.set('branchId', 'br-1')

      const res = await createTable(null, fd)
      expect(res.error).toBe('A table with this name already exists')
    })

    it('enforces active table limit of 50 tables per branch', async () => {
      const fiftyTables = Array.from({ length: 50 }, (_, i) => ({
        id: `ptbl_${i}`,
        branchId: 'br-1',
        name: `Table ${i + 1}`,
        isActive: true,
      }))
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...fiftyTables]
        callback(copy)
        return true
      })

      const fd = new FormData()
      fd.set('name', 'Table 51')
      fd.set('branchId', 'br-1')

      const res = await createTable(null, fd)
      expect(res.error).toBe('Active table limit (50) reached')
    })
  })

  describe('renameTable', () => {
    it('rejects renaming to an existing active table name', async () => {
      const existingTables = [
        { id: 'ptbl_1', branchId: 'br-1', name: 'Table 1', isActive: true },
        { id: 'ptbl_2', branchId: 'br-1', name: 'Table 2', isActive: true },
      ]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...existingTables]
        callback(copy)
        return true
      })

      const fd = new FormData()
      fd.set('tableId', 'ptbl_1')
      fd.set('newName', 'table 2')
      fd.set('branchId', 'br-1')

      const res = await renameTable(null, fd)
      expect(res.error).toBe('A table with this name already exists')
    })

    it('returns error if table to rename does not exist in branch', async () => {
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy: any[] = []
        callback(copy)
        return true
      })

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
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.POS_TABLES) return [{ id: 'tbl-1', branchId: 'br-1', isActive: true }]
        if (file === DB_FILES.POS_ORDERS) return [{ tableId: 'tbl-1', status: 'open' }]
        return []
      })

      const res = await deactivateTable('tbl-1')
      expect(res.error).toBe('Table has an active open order and cannot be deactivated')
    })

    it('returns error if table is not found', async () => {
      dbMocks.readJSON.mockImplementation(async () => [])
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
      const orders = [{ id: 'ord-1', branchId: 'br-1', tableId: 'tbl-1', status: 'open' }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

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
      const orders = [
        { id: 'ord-t1', branchId: 'br-1', date: today, orderType: 'takeaway', status: 'open' },
        { id: 'ord-t2', branchId: 'br-1', date: today, orderType: 'takeaway', status: 'voided' }, // should be excluded
        { id: 'ord-t3', branchId: 'br-1', date: today, orderType: 'takeaway', status: 'paid' },
      ]

      let createdOrder: any = null
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        createdOrder = copy[copy.length - 1]
        return true
      })

      const fd = new FormData()
      fd.set('orderType', 'takeaway')
      fd.set('branchId', 'br-1')

      const res = await createOrder(null, fd)
      expect(res.success).toBe(true)
      // Non-voided today takeaways count = 2 ('ord-t1', 'ord-t3'), so next is T-3
      expect(createdOrder?.takeawayNumber).toBe('T-3')
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
      const orders = [{ id: 'ord-1', branchId: 'br-1', status: 'billed', items: [], openedBy: 'u_mgr' }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const res = await addOrUpdateOrderItem('ord-1', 'm1', 1, 100, 'Naan')
      expect(res.error).toBe('Order is not open')
    })

    it('updates existing item quantity and note while keeping original unit price immutable', async () => {
      const orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [{ id: 'it-1', menuItemId: 'm1', quantity: 2, unitPrice: 150, nameSnapshot: 'Thali' }],
      }]

      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const res = await addOrUpdateOrderItem('ord-1', 'm1', 4, 999, 'Thali', undefined, 'Extra spicy')
      expect(res.success).toBe(true)
      const item = orders[0].items[0]
      expect(item.quantity).toBe(4)
      expect(item.unitPrice).toBe(150) // Remains 150, ignoring 999
      expect(item.note).toBe('Extra spicy')
    })

    it('waiter cannot edit order opened by another user', async () => {
      authMocks.getSession.mockResolvedValue(waiterSession)
      const orders = [{ id: 'ord-1', branchId: 'br-1', status: 'open', openedBy: 'u_other_waiter', items: [] }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const res = await addOrUpdateOrderItem('ord-1', 'm1', 1, 100, 'Naan')
      expect(res.error).toBe('Forbidden: waiters can only edit their own orders')
    })
  })

  describe('removeOrderItem', () => {
    it('returns error if item does not exist in order', async () => {
      const orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [{ id: 'it-1', menuItemId: 'm1', quantity: 1, unitPrice: 100 }],
      }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const res = await removeOrderItem('ord-1', 'it-nonexistent')
      expect(res.error).toBe('Order item not found')
    })
  })

  describe('updateOrderNote', () => {
    it('rejects note exceeding 200 characters', async () => {
      const res = await updateOrderNote('ord-1', 'A'.repeat(201))
      expect(res.error).toBe('Note must be at most 200 characters')
    })

    it('clears note to undefined when empty string is provided', async () => {
      const orders = [{ id: 'ord-1', branchId: 'br-1', status: 'open', openedBy: 'u_mgr', note: 'Existing note' }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const res = await updateOrderNote('ord-1', '')
      expect(res.success).toBe(true)
      expect(orders[0].note).toBeUndefined()
    })
  })

  // =========================================================================
  // KOT Operations
  // =========================================================================
  describe('fireKot', () => {
    it('rejects firing KOT on an empty order', async () => {
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.POS_ORDERS) return [{ id: 'ord-1', branchId: 'br-1', status: 'open', items: [], openedBy: 'u_mgr' }]
        return []
      })

      const res = await fireKot('ord-1')
      expect(res.error).toBe('Order has no items')
    })

    it('rejects firing KOT when all items have already been fired in prior KOTs', async () => {
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.POS_ORDERS) {
          return [{
            id: 'ord-1',
            branchId: 'br-1',
            status: 'open',
            openedBy: 'u_mgr',
            items: [{ menuItemId: 'm1', quantity: 2, nameSnapshot: 'Paneer' }],
          }]
        }
        if (file === DB_FILES.POS_KOTS) {
          return [{
            id: 'kot-1',
            orderId: 'ord-1',
            items: [{ menuItemId: 'm1', quantity: 2 }],
          }]
        }
        return []
      })

      const res = await fireKot('ord-1')
      expect(res.error).toBe('No new items to send to kitchen')
    })

    it('computes positive delta when item quantity is incremented', async () => {
      let createdKot: any = null
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.POS_ORDERS) {
          return [{
            id: 'ord-1',
            branchId: 'br-1',
            status: 'open',
            openedBy: 'u_mgr',
            items: [{ menuItemId: 'm1', quantity: 5, nameSnapshot: 'Paneer' }],
          }]
        }
        if (file === DB_FILES.POS_KOTS) {
          return [{
            id: 'kot-1',
            orderId: 'ord-1',
            items: [{ menuItemId: 'm1', quantity: 2 }],
          }]
        }
        return []
      })

      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy: any[] = []
        callback(copy)
        if (file === DB_FILES.POS_KOTS) createdKot = copy[0]
        return true
      })

      const res = await fireKot('ord-1')
      expect(res.success).toBe(true)
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
      const orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        items: [{ id: 'it-1', quantity: 1, unitPrice: 200 }],
      }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('discount', '250') // Exceeds 200
      fd.set('gst', '0')

      const res = await generateBill(null, fd)
      expect(res.error).toBe('Discount cannot exceed the subtotal')
    })

    it('requires confirmation if total payable is zero', async () => {
      const orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        items: [{ id: 'it-1', quantity: 1, unitPrice: 200 }],
      }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

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
      expect(orders[0].bill?.totalPayable).toBe(0)
    })

    it('is idempotent if order is already billed', async () => {
      const orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'billed',
        items: [{ id: 'it-1', quantity: 1, unitPrice: 200 }],
      }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

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
      const orders = [{ id: 'ord-1', branchId: 'br-1', status: 'paid' }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const res = await reopenOrder('ord-1')
      expect(res.error).toBe('A paid order cannot be reopened')
    })

    it('rejects reopening an open or voided order', async () => {
      const orders = [{ id: 'ord-1', branchId: 'br-1', status: 'open' }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const res = await reopenOrder('ord-1')
      expect(res.error).toBe('Only billed orders can be reopened')
    })

    it('successfully resets billed order to open and clears bill object', async () => {
      const orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'billed',
        bill: { subtotal: 100, totalPayable: 100 },
      }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const res = await reopenOrder('ord-1')
      expect(res.success).toBe(true)
      expect(orders[0].status).toBe('open')
      expect(orders[0].bill).toBeUndefined()
    })
  })

  // =========================================================================
  // Settlement & Payment
  // =========================================================================
  describe('recordPayment', () => {
    it('rejects payment if order is not in billed status', async () => {
      const orders = [{ id: 'ord-1', branchId: 'br-1', status: 'open' }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('method', 'cash')

      const res = await recordPayment(null, fd)
      expect(res.error).toBe('Order must be billed before payment')
    })

    it('rejects split payment if cash + upi does not balance with total payable', async () => {
      const orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'billed',
        bill: { totalPayable: 500 },
      }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('method', 'split')
      fd.set('cashAmount', '300')
      fd.set('upiAmount', '100') // Total = 400 != 500

      const res = await recordPayment(null, fd)
      expect(res.error).toBe('Payment amounts do not balance with total payable')
    })

    it('computes changeDue accurately when cashTendered exceeds cashAmount', async () => {
      const orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'billed',
        bill: { totalPayable: 350 },
      }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

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
      const orders = [{ id: 'ord-1', branchId: 'br-1', status: 'paid', payment: { paidAt: new Date().toISOString() } }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('reason', 'Customer requested refund')

      const res = await voidOrder(null, fd)
      expect(res.error).toBe('Forbidden')
    })

    it('global admin can void a paid order on the same calendar day', async () => {
      authMocks.getSession.mockResolvedValue(adminSession) // Global admin
      const orders = [{ id: 'ord-1', branchId: 'br-1', status: 'paid', payment: { paidAt: new Date().toISOString() } }]
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const fd = new FormData()
      fd.set('orderId', 'ord-1')
      fd.set('reason', 'Accidental double charge')

      const res = await voidOrder(null, fd)
      expect(res.success).toBe(true)
      expect(orders[0].status).toBe('voided')
      expect(orders[0].void?.reason).toBe('Accidental double charge')
    })
  })

  describe('advanceKotStatus', () => {
    it('advances KOT sequentially through pending -> preparing -> ready -> served', async () => {
      const kot = { id: 'kot-1', branchId: 'br-1', status: 'pending' }
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [kot]
        callback(copy)
        return true
      })

      await advanceKotStatus('kot-1')
      expect(kot.status).toBe('preparing')

      await advanceKotStatus('kot-1')
      expect(kot.status).toBe('ready')

      await advanceKotStatus('kot-1')
      expect(kot.status).toBe('served')
    })

    it('rejects advancing a KOT that is already served', async () => {
      const kot = { id: 'kot-1', branchId: 'br-1', status: 'served' }
      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [kot]
        callback(copy)
        return true
      })

      const res = await advanceKotStatus('kot-1')
      expect(res.error).toBe('KOT is already served')
    })
  })
})
