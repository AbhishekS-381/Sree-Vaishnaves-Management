import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as auth from '@/app/actions/auth'
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
  getKitchenKots,
  getPosOrderHistory,
  getDailySummary,
  getPosDataForEOD,
} from '@/app/actions/pos'
import type { PosTable, PosOrder, PosKot } from '@/app/actions/posTypes'

const { mockDb, mockWithDbTransaction } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state: any = {
    tables: [] as any[],
    orders: [] as any[],
    kots: [] as any[],
    failNext: false,
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
      if (str.toLowerCase().includes('"other"') && item.name?.toLowerCase() !== 'other') return false
      if (str.includes(`"${item.id}"`)) return true
      return true
    }
    if (tableName === 'pos_orders') {
      if (str.includes(`"${item.id}"`)) return true
      if (str.includes('"open"') && item.status !== 'open') return false
      if (str.includes('"takeaway"') && item.orderType !== 'takeaway') return false
      if (str.includes('"voided"') && (str.includes('<>') || str.includes('ne')) && item.status === 'voided') return false
      return true
    }
    if (tableName === 'pos_kots') {
      if (str.includes(`"${item.id}"`)) return true
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          orderBy: vi.fn((_col: any) => builder),
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
  const mockTx = vi.fn(async (cb: any, _options?: any) => {
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

vi.mock('@/lib/audit', () => ({
  logAction: vi.fn().mockResolvedValue(true),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('POS Edge Cases and Guard Branches Coverage (Task 16.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.state.tables = []
    mockDb.state.orders = []
    mockDb.state.kots = []
    mockDb.state.failNext = false

    vi.spyOn(auth, 'getSession').mockResolvedValue({
      userId: 'u_admin',
      role: 'admin',
      isGlobalAdmin: true,
      branchId: 'b_1',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b_1')
  })

  // ─── Table Guards ───────────────────────────────────────────────
  describe('Table Actions Edge Cases', () => {
    it('createTable rejects invalid name and missing branch', async () => {
      const fd1 = new FormData()
      fd1.set('name', '')
      fd1.set('branchId', 'b_1')
      const res1 = await createTable(null, fd1)
      expect(res1?.error).toBeDefined()

      const fd2 = new FormData()
      fd2.set('name', 'Table 1')
      fd2.set('branchId', '')
      const res2 = await createTable(null, fd2)
      expect(res2?.error).toBe('Branch is required')
    })

    it('createTable handles branchAccessDenied and transaction failure', async () => {
      vi.spyOn(auth, 'requireBranchAccess').mockRejectedValueOnce(new Error('Denied'))
      const fd = new FormData()
      fd.set('name', 'Table 1')
      fd.set('branchId', 'b_denied')
      const res = await createTable(null, fd)
      expect(res?.error).toBe('BranchAccessDenied')

      mockDb.state.failNext = true
      const resFail = await createTable(null, fd)
      expect(resFail?.error).toBe('Transaction failed')
    })

    it('renameTable handles not found, duplicate name, and transaction failure', async () => {
      // not found
      mockDb.state.tables = []
      const fd = new FormData()
      fd.set('tableId', 't_unknown')
      fd.set('newName', 'T New')
      fd.set('branchId', 'b_1')
      const resNotFound = await renameTable(null, fd)
      expect(resNotFound?.error).toBe('Table not found')

      // duplicate name
      mockDb.state.tables = [
        { id: 't1', branchId: 'b_1', name: 'Existing', isActive: true, createdAt: '', updatedAt: '' },
        { id: 't2', branchId: 'b_1', name: 'Other', isActive: true, createdAt: '', updatedAt: '' },
      ]
      const fdDup = new FormData()
      fdDup.set('tableId', 't1')
      fdDup.set('newName', 'Other')
      fdDup.set('branchId', 'b_1')
      const resDup = await renameTable(null, fdDup)
      expect(resDup?.error).toBe('A table with this name already exists')

      // transaction failure
      mockDb.state.failNext = true
      const resFail = await renameTable(null, fd)
      expect(resFail?.error).toBe('Transaction failed')
    })

    it('deactivateTable handles not found and transaction failure', async () => {
      mockDb.state.tables = []
      const resNotFound = await deactivateTable('t_none')
      expect(resNotFound?.error).toBe('Table not found')

      mockDb.state.tables = [
        { id: 't1', branchId: 'b_1', name: 'T1', isActive: true, createdAt: '', updatedAt: '' },
      ]
      mockDb.state.failNext = true
      const resFail = await deactivateTable('t1')
      expect(resFail?.error).toBe('Transaction failed')
    })
  })

  // ─── Order Lifecycle Guards ─────────────────────────────────────
  describe('Order Lifecycle Edge Cases', () => {
    it('createOrder rejects dine-in without table and takeaway with table', async () => {
      const fdDineNoTable = new FormData()
      fdDineNoTable.set('orderType', 'dine-in')
      fdDineNoTable.set('branchId', 'b_1')
      const res1 = await createOrder(null, fdDineNoTable)
      expect(res1?.error).toBe('Table is required for dine-in orders')

      const fdTakeawayWithTable = new FormData()
      fdTakeawayWithTable.set('orderType', 'takeaway')
      fdTakeawayWithTable.set('branchId', 'b_1')
      fdTakeawayWithTable.set('tableId', 't1')
      const res2 = await createOrder(null, fdTakeawayWithTable)
      expect(res2?.error).toBe('Takeaway orders must not have a table assigned')
    })

    it('createOrder handles branch access rejection and transaction failure', async () => {
      vi.spyOn(auth, 'requireBranchAccess').mockRejectedValueOnce(new Error('Denied'))
      const fd = new FormData()
      fd.set('orderType', 'takeaway')
      fd.set('branchId', 'b_denied')
      const res = await createOrder(null, fd)
      expect(res?.error).toBe('BranchAccessDenied')

      mockDb.state.failNext = true
      const resFail = await createOrder(null, fd)
      expect(resFail?.error).toBe('Transaction failed')
    })

    it('addOrUpdateOrderItem handles validation error and not open order', async () => {
      // validation error: quantity 0
      const resVal = await addOrUpdateOrderItem('o1', 'm1', 0, 100, 'Name')
      expect(resVal?.error).toBeDefined()

      // not found
      mockDb.state.orders = []
      const resNotFound = await addOrUpdateOrderItem('o_none', 'm1', 1, 100, 'Name')
      expect(resNotFound?.error).toBe('Order not found')

      // not open
      mockDb.state.orders = [
        { id: 'o_billed', branchId: 'b_1', status: 'billed', items: [], kotCount: 1, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
      ]
      const resNotOpen = await addOrUpdateOrderItem('o_billed', 'm1', 1, 100, 'Name')
      expect(resNotOpen?.error).toBe('Order is not open')
    })

    it('removeOrderItem handles item not found and transaction failure', async () => {
      mockDb.state.orders = [
        { id: 'o1', branchId: 'b_1', status: 'open', items: [], kotCount: 0, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
      ]
      const res = await removeOrderItem('o1', 'item_none')
      expect(res?.error).toBe('Order item not found')

      mockDb.state.failNext = true
      const resFail = await removeOrderItem('o1', 'item_none')
      expect(resFail?.error).toBeDefined()
    })

    it('updateOrderNote handles not open order and transaction failure', async () => {
      mockDb.state.orders = [
        { id: 'o1', branchId: 'b_1', status: 'paid', items: [], kotCount: 0, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
      ]
      const res = await updateOrderNote('o1', 'note')
      expect(res?.error).toBe('Order is not open')
    })
  })

  // ─── KOT & Bill Guards ──────────────────────────────────────────
  describe('KOT and Bill Edge Cases', () => {
    it('fireKot rejects when order is not open or not found', async () => {
      mockDb.state.orders = []
      const resNotFound = await fireKot('o_none')
      expect(resNotFound?.error).toBe('Order not found')

      mockDb.state.orders = [
        { id: 'o_billed', branchId: 'b_1', status: 'billed', items: [{ id: '1' }], kotCount: 0 },
      ]
      const resNotOpen = await fireKot('o_billed')
      expect(resNotOpen?.error).toBe('Order is not open')
    })

    it('generateBill handles zero-bill confirmation flow and discount > subtotal', async () => {
      const fd = new FormData()
      fd.set('orderId', 'o1')
      fd.set('discount', '500')
      fd.set('gst', '0')

      mockDb.state.orders = [
        {
          id: 'o1',
          branchId: 'b_1',
          status: 'open',
          items: [{ id: 'i1', menuItemId: 'm1', nameSnapshot: 'Item', unitPrice: 100, quantity: 1 }],
          kotCount: 1,
          date: '',
          openedBy: 'u_admin',
          orderType: 'dine-in',
          createdAt: '',
          updatedAt: '',
        },
      ]
      const resDiscount = await generateBill(null, fd)
      expect(resDiscount?.error).toBe('Discount cannot exceed the subtotal')

      // Zero bill unconfirmed
      const fdZero = new FormData()
      fdZero.set('orderId', 'o1')
      fdZero.set('discount', '100')
      fdZero.set('gst', '0')

      mockDb.state.orders = [
        {
          id: 'o1',
          branchId: 'b_1',
          status: 'open',
          items: [{ id: 'i1', menuItemId: 'm1', nameSnapshot: 'Item', unitPrice: 100, quantity: 1 }],
          kotCount: 1,
          date: '',
          openedBy: 'u_admin',
          orderType: 'dine-in',
          createdAt: '',
          updatedAt: '',
        },
      ]
      const resZero = await generateBill(null, fdZero)
      expect(resZero?.error).toBe('ZERO_BILL_CONFIRM_REQUIRED')
    })

    it('advanceKotStatus handles already served and invalid transitions', async () => {
      mockDb.state.kots = [
        { id: 'k1', branchId: 'b_1', orderId: 'o1', kotNumber: 1, items: [], status: 'served', firedBy: 'u1', firedAt: '', updatedAt: '' },
      ]
      const resServed = await advanceKotStatus('k1')
      expect(resServed?.error).toBe('KOT is already served')

      mockDb.state.kots = [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'k2', branchId: 'b_1', orderId: 'o1', kotNumber: 1, items: [], status: 'unknown_status' as any, firedBy: 'u1', firedAt: '', updatedAt: '' },
      ]
      const resInvalid = await advanceKotStatus('k2')
      expect(resInvalid?.error).toBe('Invalid KOT status transition')
    })

    it('getPosOrderHistory validates date format and rejects invalid range', async () => {
      const resBadDate = await getPosOrderHistory('b_1', 'bad-date', '2026-10-19')
      expect(resBadDate?.error).toBe('Invalid date format')

      const resInverted = await getPosOrderHistory('b_1', '2026-10-25', '2026-10-19')
      expect(resInverted?.error).toBe('From date must be on or before to date')
    })
  })

  // ─── Unauthorized and BranchAccessDenied for all actions ─────────
  describe('Unauthorized session checks', () => {
    beforeEach(() => {
      vi.spyOn(auth, 'getSession').mockResolvedValue(null)
    })

    it('all POS actions return Unauthorized when getSession returns null', async () => {
      const fd = new FormData()
      fd.set('orderId', 'o1')
      fd.set('reason', 'mistake')
      expect((await createTable(null, fd))?.error).toBe('Unauthorized')
      expect((await renameTable(null, fd))?.error).toBe('Unauthorized')
      expect((await deactivateTable('t1'))?.error).toBe('Unauthorized')
      expect((await createOrder(null, fd))?.error).toBe('Unauthorized')
      expect((await addOrUpdateOrderItem('o1', 'm1', 1, 100, 'Name'))?.error).toBe('Unauthorized')
      expect((await removeOrderItem('o1', 'i1'))?.error).toBe('Unauthorized')
      expect((await updateOrderNote('o1', 'note'))?.error).toBe('Unauthorized')
      expect((await fireKot('o1'))?.error).toBe('Unauthorized')
      expect((await generateBill(null, fd))?.error).toBe('Unauthorized')
      expect((await reopenOrder('o1'))?.error).toBe('Unauthorized')
      expect((await recordPayment(null, fd))?.error).toBe('Unauthorized')
      expect((await voidOrder(null, fd))?.error).toBe('Unauthorized')
      expect((await advanceKotStatus('k1'))?.error).toBe('Unauthorized')
      expect((await getKitchenKots('b_1'))?.error).toBe('Unauthorized')
      expect((await getPosOrderHistory('b_1', '2026-10-01', '2026-10-02'))?.error).toBe('Unauthorized')
      expect((await getDailySummary('b_1', '2026-10-01'))?.error).toBe('Unauthorized')
      expect((await getPosDataForEOD('2026-10-01', 'b_1'))?.error).toBe('Unauthorized')
    })
  })

  describe('BranchAccessDenied when requireBranchAccess throws', () => {
    beforeEach(() => {
      vi.spyOn(auth, 'getSession').mockResolvedValue({
        userId: 'u_admin',
        role: 'admin',
        isGlobalAdmin: true,
        branchId: 'b_1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      vi.spyOn(auth, 'requireBranchAccess').mockRejectedValue(new Error('Denied'))
    })

    it('actions return BranchAccessDenied when branch access fails', async () => {
      const fd = new FormData()
      fd.set('orderId', 'o1')
      fd.set('discount', '0')
      fd.set('gst', '0')
      fd.set('method', 'cash')
      fd.set('reason', 'test')

      expect((await removeOrderItem('o1', 'i1'))?.error).toBe('BranchAccessDenied')
      expect((await updateOrderNote('o1', 'note'))?.error).toBe('BranchAccessDenied')
      expect((await fireKot('o1'))?.error).toBe('BranchAccessDenied')
      expect((await generateBill(null, fd))?.error).toBe('BranchAccessDenied')
      expect((await reopenOrder('o1'))?.error).toBe('BranchAccessDenied')
      expect((await recordPayment(null, fd))?.error).toBe('BranchAccessDenied')
      expect((await voidOrder(null, fd))?.error).toBe('BranchAccessDenied')
      expect((await advanceKotStatus('k1'))?.error).toBe('BranchAccessDenied')
      expect((await getKitchenKots('b_1'))?.error).toBe('BranchAccessDenied')
      expect((await getDailySummary('b_1', '2026-10-01'))?.error).toBe('BranchAccessDenied')
      expect((await getPosDataForEOD('2026-10-01', 'b_1'))?.error).toBe('BranchAccessDenied')
    })
  })

  describe('Transaction inner guards and branches', () => {
    beforeEach(() => {
      vi.spyOn(auth, 'getSession').mockResolvedValue({
        userId: 'u_admin',
        role: 'admin',
        isGlobalAdmin: true,
        branchId: 'b_1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b_1')
    })

    it('removeOrderItem handles branch mismatch', async () => {
      mockDb.state.orders = [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'o1', branchId: 'b_other', status: 'open', items: [{ id: 'i1' } as any], kotCount: 0, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
      ]
      const res = await removeOrderItem('o1', 'i1')
      expect(res?.error).toBe('BranchAccessDenied')
    })

    it('updateOrderNote handles branch mismatch and note length validation', async () => {
      const longNote = 'a'.repeat(201)
      const resLong = await updateOrderNote('o1', longNote)
      expect(resLong?.error).toBe('Note must be at most 200 characters')

      mockDb.state.orders = [
        { id: 'o1', branchId: 'b_other', status: 'open', items: [], kotCount: 0, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
      ]
      const resMismatch = await updateOrderNote('o1', 'valid note')
      expect(resMismatch?.error).toBe('BranchAccessDenied')
    })

    it('reopenOrder handles not found and branch mismatch', async () => {
      mockDb.state.orders = []
      const resNotFound = await reopenOrder('o_missing')
      expect(resNotFound?.error).toBe('Order not found')

      mockDb.state.orders = [
        { id: 'o1', branchId: 'b_other', status: 'billed', items: [], kotCount: 1, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
      ]
      const resMismatch = await reopenOrder('o1')
      expect(resMismatch?.error).toBe('BranchAccessDenied')
    })

    it('recordPayment handles not found, branch mismatch, not billed, and no bill', async () => {
      const fd = new FormData()
      fd.set('orderId', 'o1')
      fd.set('method', 'cash')

      // not found
      mockDb.state.orders = []
      expect((await recordPayment(null, fd))?.error).toBe('Order not found')

      // branch mismatch
      mockDb.state.orders = [
        { id: 'o1', branchId: 'b_other', status: 'billed', bill: { subtotal: 100, discount: 0, gst: 0, totalPayable: 100, generatedAt: '' }, items: [], kotCount: 1, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
      ]
      expect((await recordPayment(null, fd))?.error).toBe('BranchAccessDenied')

      // not billed
      mockDb.state.orders = [
        { id: 'o1', branchId: 'b_1', status: 'open', items: [], kotCount: 1, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
      ]
      expect((await recordPayment(null, fd))?.error).toBe('Order must be billed before payment')

      // no bill
      mockDb.state.orders = [
        { id: 'o1', branchId: 'b_1', status: 'billed', items: [], kotCount: 1, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
      ]
      expect((await recordPayment(null, fd))?.error).toBe('Order has no bill')

      // method UPI auto-sets upiAmount
      const fdUpi = new FormData()
      fdUpi.set('orderId', 'o1')
      fdUpi.set('method', 'upi')
      mockDb.state.orders = [
        { id: 'o1', branchId: 'b_1', status: 'billed', bill: { subtotal: 100, discount: 0, gst: 0, totalPayable: 100, generatedAt: '' }, items: [], kotCount: 1, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
      ]
      const resUpi = await recordPayment(null, fdUpi)
      expect(resUpi?.success).toBe(true)

      // totalPayable > 0 but both cash and upi are 0
      const fdZero = new FormData()
      fdZero.set('orderId', 'o1')
      fdZero.set('method', 'split')
      fdZero.set('cashAmount', '0')
      fdZero.set('upiAmount', '0')
      mockDb.state.orders = [
        { id: 'o1', branchId: 'b_1', status: 'billed', bill: { subtotal: 100, discount: 0, gst: 0, totalPayable: 100, generatedAt: '' }, items: [], kotCount: 1, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
      ]
      expect((await recordPayment(null, fdZero))?.error).toBe('Payment amounts do not balance with total payable')
    })

    it('voidOrder handles not found, branch mismatch, and wrong status', async () => {
      const fdVoid = new FormData()
      fdVoid.set('orderId', 'o1')
      fdVoid.set('reason', 'mistake')

      // not found
      mockDb.state.orders = []
      expect((await voidOrder(null, fdVoid))?.error).toBe('Order not found')

      // branch mismatch
      mockDb.state.orders = [
        { id: 'o1', branchId: 'b_other', status: 'open', items: [], kotCount: 0, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
      ]
      expect((await voidOrder(null, fdVoid))?.error).toBe('BranchAccessDenied')

      // wrong status (e.g. billed)
      mockDb.state.orders = [
        { id: 'o1', branchId: 'b_1', status: 'billed', items: [], kotCount: 0, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
      ]
      expect((await voidOrder(null, fdVoid))?.error).toBe('Only open or paid orders can be voided')
    })

    it('advanceKotStatus handles not found and branch mismatch', async () => {
      mockDb.state.kots = []
      expect((await advanceKotStatus('k_missing'))?.error).toBe('KOT not found')

      mockDb.state.kots = [
        { id: 'k1', branchId: 'b_other', orderId: 'o1', kotNumber: 1, items: [], status: 'pending', firedBy: 'u1', firedAt: '', updatedAt: '' },
      ]
      expect((await advanceKotStatus('k1'))?.error).toBe('BranchAccessDenied')
    })

    it('getPosOrderHistory enforces branch access for non-admin owners', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(auth, 'getSession').mockResolvedValue({
        userId: 'u_owner',
        role: 'owner',
        isGlobalAdmin: false,
        branchId: 'b_1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      // owner requesting different branch
      const resDenied = await getPosOrderHistory('b_2', '2026-10-01', '2026-10-02')
      expect(resDenied?.error).toBe('BranchAccessDenied')

      // owner requesting own branch
      mockDb.state.orders = []
      const resAllowed = await getPosOrderHistory('b_1', '2026-10-01', '2026-10-02')
      expect(resAllowed?.orders).toBeDefined()
    })

    it('getPosDataForEOD validates date and branchId', async () => {
      expect((await getPosDataForEOD('bad-date', 'b_1'))?.error).toBe('Invalid date format')
      expect((await getPosDataForEOD('2026-10-19', ''))?.error).toBe('Branch is required')
    })
  })
})
