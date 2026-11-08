import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as auth from '@/app/actions/auth'
import * as audit from '@/lib/audit'
import {
  createOrder,
  addOrUpdateOrderItem,
  toggleOrderItemParcel,
  removeOrderItem,
  updateOrderNote,
  fireKot,
} from '@/app/actions/pos'
import type { PosOrder, PosKot } from '@/app/actions/posTypes'

const { mockDb, mockWithDbTransaction } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state: any = {
    orders: [] as any[],
    kots: [] as any[],
    failNext: false,
    lastTxOptions: null as any,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCollection = (tableName?: string): any[] => {
    if (tableName === 'pos_orders') return state.orders
    if (tableName === 'pos_kots') return state.kots
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filterItem = (tableName: string, item: any, str: string): boolean => {
    if (tableName === 'pos_orders') {
      if (str.includes('"open"') && item.status !== 'open') return false
      if (str.includes('"ptbl_1"') && item.tableId !== 'ptbl_1') return false
      if (str.includes('"ord_1"') && item.id !== 'ord_1') return false
      if (str.includes('"takeaway"') && item.orderType !== 'takeaway') return false
      if (str.includes('"voided"') && (str.includes('<>') || str.includes('ne')) && item.status === 'voided') return false
      return true
    }
    if (tableName === 'pos_kots') {
      if (str.includes('"ord_1"') && item.orderId !== 'ord_1') return false
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
            if (str.includes(`"${item.id}"`) || filterItem(table?.tableName || '', item, str)) {
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

vi.mock('@/lib/audit', () => ({
  logAction: vi.fn().mockResolvedValue(true),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('POS Order Lifecycle Actions (Tasks 5.1, 5.2, 5.3, 5.4, 5.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.state.orders = []
    mockDb.state.kots = []
    mockDb.state.failNext = false
    mockDb.state.lastTxOptions = null

    vi.spyOn(auth, 'getSession').mockResolvedValue({
      userId: 'u_waiter_1',
      role: 'waiter',
      isGlobalAdmin: false,
      branchId: 'b_1',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b_1')
  })

  // ─── createOrder ───────────────────────────────────────────────────
  describe('createOrder', () => {
    it('creates a dine-in order with tableId and default covers', async () => {
      mockDb.state.orders = []

      const fd = new FormData()
      fd.set('orderType', 'dine-in')
      fd.set('branchId', 'b_1')
      fd.set('tableId', 'ptbl_1')
      fd.set('covers', '2')

      const res = await createOrder({}, fd)
      expect(res).toEqual({ success: true })
      expect(mockDb.state.orders.length).toBe(1)
      const saved = mockDb.state.orders[0]
      expect(saved.orderType).toBe('dine-in')
      expect(saved.tableId).toBe('ptbl_1')
      expect(saved.covers).toBe(2)
      expect(saved.status).toBe('open')
      expect(saved.openedBy).toBe('u_waiter_1')
      expect(saved.id).toBeTruthy()

      expect(audit.logAction).toHaveBeenCalledWith(
        'CREATE_POS_ORDER',
        'POS_ORDER',
        expect.stringContaining('"orderType":"dine-in"'),
        saved.id
      )
    })

    it('creates a takeaway order with sequential T-N number and no tableId', async () => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      mockDb.state.orders = [
        {
          id: 'pord_t1',
          branchId: 'b_1',
          orderType: 'takeaway',
          takeawayNumber: 'T-1',
          status: 'paid',
          items: [],
          kotCount: 1,
          date: today,
          openedBy: 'u_waiter_1',
          createdAt: '',
          updatedAt: '',
        },
      ]

      const fd = new FormData()
      fd.set('orderType', 'takeaway')
      fd.set('branchId', 'b_1')

      const res = await createOrder({}, fd)
      expect(res).toEqual({ success: true })
      expect(mockDb.state.orders.length).toBe(2)
      expect(mockDb.state.orders[1].takeawayNumber).toBe('T-2')
      expect(mockDb.state.orders[1].tableId).toBeNull()
      expect(mockDb.state.lastTxOptions).toEqual({ isolationLevel: 'serializable' })
    })

    it('rejects dine-in order without tableId', async () => {
      const fd = new FormData()
      fd.set('orderType', 'dine-in')
      fd.set('branchId', 'b_1')

      const res = await createOrder({}, fd)
      expect(res).toEqual({ error: 'Table is required for dine-in orders' })
    })

    it('rejects takeaway order with tableId', async () => {
      const fd = new FormData()
      fd.set('orderType', 'takeaway')
      fd.set('branchId', 'b_1')
      fd.set('tableId', 'ptbl_1')

      const res = await createOrder({}, fd)
      expect(res).toEqual({ error: 'Takeaway orders must not have a table assigned' })
    })

    it('rejects creating dine-in order on an occupied table', async () => {
      mockDb.state.orders = [
        {
          id: 'pord_existing',
          branchId: 'b_1',
          tableId: 'ptbl_1',
          orderType: 'dine-in',
          status: 'open', // active open order
          items: [],
          kotCount: 0,
          date: '2026-10-15',
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
        },
      ]

      const fd = new FormData()
      fd.set('orderType', 'dine-in')
      fd.set('branchId', 'b_1')
      fd.set('tableId', 'ptbl_1')

      const res = await createOrder({}, fd)
      expect(res).toEqual({ error: 'Table already has an open order' })
    })

    it('denies billing or kitchen role from creating orders', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.getSession).mockResolvedValueOnce({
        role: 'billing',
        isGlobalAdmin: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const fd = new FormData()
      fd.set('orderType', 'takeaway')
      fd.set('branchId', 'b_1')

      const res = await createOrder({}, fd)
      expect(res).toEqual({ error: 'Forbidden' })
    })
  })

  // ─── addOrUpdateOrderItem ──────────────────────────────────────────
  describe('addOrUpdateOrderItem', () => {
    it('adds a new item to order', async () => {
      mockDb.state.orders = [
        {
          id: 'ord_1',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'open',
          items: [],
          kotCount: 0,
          date: '2026-10-15',
          openedBy: 'u_waiter_1',
          createdAt: '',
          updatedAt: '',
        },
      ]

      const res = await addOrUpdateOrderItem(
        'ord_1',
        'item_idli',
        2,
        40,
        'Idli',
        undefined,
        'Extra sambar'
      )

      expect(res).toEqual({ success: true })
      const order = mockDb.state.orders[0]
      expect(order.items.length).toBe(1)
      expect(order.items[0].nameSnapshot).toBe('Idli')
      expect(order.items[0].quantity).toBe(2)
      expect(order.items[0].unitPrice).toBe(40)
      expect(order.items[0].note).toBe('Extra sambar')
    })

    it('updates quantity and note of existing item while keeping unitPrice immutable', async () => {
      mockDb.state.orders = [
        {
          id: 'ord_1',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'open',
          items: [
            {
              id: 'oi_1',
              menuItemId: 'item_idli',
              nameSnapshot: 'Idli',
              quantity: 2,
              unitPrice: 40, // original price
            },
          ],
          kotCount: 0,
          date: '2026-10-15',
          openedBy: 'u_waiter_1',
          createdAt: '',
          updatedAt: '',
        },
      ]

      // Attempt to pass 50 as unitPrice (new catalog price)
      const res = await addOrUpdateOrderItem(
        'ord_1',
        'item_idli',
        4,
        50,
        'Idli',
        undefined,
        'No spicy'
      )

      expect(res).toEqual({ success: true })
      const order = mockDb.state.orders[0]
      expect(order.items[0].quantity).toBe(4)
      expect(order.items[0].unitPrice).toBe(40) // IMMUTABLE!
      expect(order.items[0].note).toBe('No spicy')
    })

    it('rejects edit by different waiter (waiter ownership isolation)', async () => {
      mockDb.state.orders = [
        {
          id: 'ord_1',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'open',
          items: [],
          kotCount: 0,
          date: '2026-10-15',
          openedBy: 'u_waiter_2', // owned by waiter 2
          createdAt: '',
          updatedAt: '',
        },
      ]

      // Current session is u_waiter_1
      const res = await addOrUpdateOrderItem('ord_1', 'item_idli', 1, 40, 'Idli')
      expect(res).toEqual({ error: 'Forbidden: waiters can only edit their own orders' })
    })

    it('allows manager to edit waiter order', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.getSession).mockResolvedValueOnce({
        userId: 'u_mgr',
        role: 'manager',
        isGlobalAdmin: false,
        branchId: 'b_1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      mockDb.state.orders = [
        {
          id: 'ord_1',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'open',
          items: [],
          kotCount: 0,
          date: '2026-10-15',
          openedBy: 'u_waiter_2',
          createdAt: '',
          updatedAt: '',
        },
      ]

      const res = await addOrUpdateOrderItem('ord_1', 'item_idli', 1, 40, 'Idli')
      expect(res).toEqual({ success: true })
      expect(mockDb.state.orders[0].items.length).toBe(1)
    })

    it('supports distinct line items for dine-in and parcel portions of the same menu item', async () => {
      mockDb.state.orders = [
        {
          id: 'ord_1',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'open',
          items: [],
          kotCount: 0,
          date: '2026-10-15',
          openedBy: 'u_waiter_1',
          createdAt: '',
          updatedAt: '',
        },
      ]

      // Add 2x Dine-in Masala Dosa
      await addOrUpdateOrderItem('ord_1', 'm_dosa', 2, 60, 'Masala Dosa', undefined, undefined, false)
      // Add 1x Parcel Masala Dosa
      await addOrUpdateOrderItem('ord_1', 'm_dosa', 1, 70, 'Parcel Masala Dosa', undefined, undefined, true)

      const order = mockDb.state.orders[0]
      expect(order.items.length).toBe(2)
      expect(order.items[0].nameSnapshot).toBe('Masala Dosa')
      expect(order.items[0].quantity).toBe(2)
      expect(order.items[0].isParcel).toBe(false)
      expect(order.items[1].nameSnapshot).toBe('Parcel Masala Dosa')
      expect(order.items[1].quantity).toBe(1)
      expect(order.items[1].isParcel).toBe(true)
    })
  })

  // ─── toggleOrderItemParcel ─────────────────────────────────────────
  describe('toggleOrderItemParcel', () => {
    it('toggles dine-in item to parcel and updates unit price and snapshot', async () => {
      mockDb.state.orders = [
        {
          id: 'ord_1',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'open',
          items: [
            {
              id: 'oi_1',
              menuItemId: 'm_dosa',
              nameSnapshot: 'Masala Dosa',
              unitPrice: 60,
              quantity: 2,
              isParcel: false,
            },
          ],
          kotCount: 0,
          date: '2026-10-15',
          openedBy: 'u_waiter_1',
          createdAt: '',
          updatedAt: '',
        },
      ]

      const res = await toggleOrderItemParcel('ord_1', 'oi_1', 70, 'Parcel Masala Dosa')
      expect(res).toEqual({ success: true })
      const order = mockDb.state.orders[0]
      expect(order.items[0].isParcel).toBe(true)
      expect(order.items[0].unitPrice).toBe(70)
      expect(order.items[0].nameSnapshot).toBe('Parcel Masala Dosa')
    })

    it('merges quantity into existing item when toggling matches target parcel status', async () => {
      mockDb.state.orders = [
        {
          id: 'ord_1',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'open',
          items: [
            {
              id: 'oi_1',
              menuItemId: 'm_dosa',
              nameSnapshot: 'Masala Dosa',
              unitPrice: 60,
              quantity: 2,
              isParcel: false,
            },
            {
              id: 'oi_2',
              menuItemId: 'm_dosa',
              nameSnapshot: 'Parcel Masala Dosa',
              unitPrice: 70,
              quantity: 3,
              isParcel: true,
            },
          ],
          kotCount: 0,
          date: '2026-10-15',
          openedBy: 'u_waiter_1',
          createdAt: '',
          updatedAt: '',
        },
      ]

      // Toggling oi_1 (dine-in) to parcel should merge its 2 qty into oi_2 (parcel) -> total 5
      const res = await toggleOrderItemParcel('ord_1', 'oi_1')
      expect(res).toEqual({ success: true })
      const order = mockDb.state.orders[0]
      expect(order.items.length).toBe(1)
      expect(order.items[0].id).toBe('oi_2')
      expect(order.items[0].quantity).toBe(5)
      expect(order.items[0].isParcel).toBe(true)
    })

    it('rejects toggle on non-open order', async () => {
      mockDb.state.orders = [
        {
          id: 'ord_1',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'billed',
          items: [{ id: 'oi_1', menuItemId: 'm1', nameSnapshot: 'Idli', quantity: 2, unitPrice: 40 }],
          kotCount: 1,
          date: '2026-10-15',
          openedBy: 'u_waiter_1',
          createdAt: '',
          updatedAt: '',
        },
      ]

      const res = await toggleOrderItemParcel('ord_1', 'oi_1')
      expect(res).toEqual({ error: 'Order is not open' })
    })

    it('rejects toggle by different waiter', async () => {
      mockDb.state.orders = [
        {
          id: 'ord_1',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'open',
          items: [{ id: 'oi_1', menuItemId: 'm1', nameSnapshot: 'Idli', quantity: 2, unitPrice: 40 }],
          kotCount: 0,
          date: '2026-10-15',
          openedBy: 'u_waiter_2',
          createdAt: '',
          updatedAt: '',
        },
      ]

      const res = await toggleOrderItemParcel('ord_1', 'oi_1')
      expect(res).toEqual({ error: 'Forbidden: waiters can only edit their own orders' })
    })
  })

  // ─── removeOrderItem ───────────────────────────────────────────────
  describe('removeOrderItem', () => {
    it('removes item from open order', async () => {
      mockDb.state.orders = [
        {
          id: 'ord_1',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'open',
          items: [
            { id: 'oi_1', menuItemId: 'm1', nameSnapshot: 'Idli', quantity: 2, unitPrice: 40 },
            { id: 'oi_2', menuItemId: 'm2', nameSnapshot: 'Vada', quantity: 1, unitPrice: 30 },
          ],
          kotCount: 0,
          date: '2026-10-15',
          openedBy: 'u_waiter_1',
          createdAt: '',
          updatedAt: '',
        },
      ]

      const res = await removeOrderItem('ord_1', 'oi_1')
      expect(res).toEqual({ success: true })
      expect(mockDb.state.orders[0].items.length).toBe(1)
      expect(mockDb.state.orders[0].items[0].id).toBe('oi_2')
    })

    it('rejects removal from non-open order', async () => {
      mockDb.state.orders = [
        {
          id: 'ord_1',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'billed', // billed
          items: [{ id: 'oi_1', menuItemId: 'm1', nameSnapshot: 'Idli', quantity: 2, unitPrice: 40 }],
          kotCount: 1,
          date: '2026-10-15',
          openedBy: 'u_waiter_1',
          createdAt: '',
          updatedAt: '',
        },
      ]

      const res = await removeOrderItem('ord_1', 'oi_1')
      expect(res).toEqual({ error: 'Order is not open' })
    })
  })

  // ─── updateOrderNote ───────────────────────────────────────────────
  describe('updateOrderNote', () => {
    it('updates order-level note', async () => {
      mockDb.state.orders = [
        {
          id: 'ord_1',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'open',
          items: [],
          kotCount: 0,
          date: '2026-10-15',
          openedBy: 'u_waiter_1',
          createdAt: '',
          updatedAt: '',
        },
      ]

      const res = await updateOrderNote('ord_1', 'Table requested corner seating')
      expect(res).toEqual({ success: true })
      expect(mockDb.state.orders[0].note).toBe('Table requested corner seating')
    })
  })

  // ─── fireKot ───────────────────────────────────────────────────────
  describe('fireKot', () => {
    it('fires initial KOT with all order items and derives kotNumber 1', async () => {
      const order: PosOrder = {
        id: 'ord_1',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'open',
        items: [
          { id: 'oi_1', menuItemId: 'm1', nameSnapshot: 'Idli', quantity: 2, unitPrice: 40, note: 'Spicy' },
          { id: 'oi_2', menuItemId: 'm2', nameSnapshot: 'Dosa', quantity: 1, unitPrice: 60 },
        ],
        kotCount: 0,
        date: '2026-10-15',
        openedBy: 'u_waiter_1',
        createdAt: '',
        updatedAt: '',
      }

      mockDb.state.orders = [order]
      mockDb.state.kots = []

      const res = await fireKot('ord_1')
      expect(res).toEqual({ success: true })
      expect(mockDb.state.kots.length).toBe(1)
      const savedKot = mockDb.state.kots[0]
      expect(savedKot.kotNumber).toBe(1)
      expect(savedKot.status).toBe('pending')
      expect(savedKot.items.length).toBe(2)
      expect(savedKot.items[0].quantity).toBe(2)
      expect(savedKot.items[0].nameSnapshot).toBe('Idli')
      expect(savedKot.items[0].note).toBe('Spicy')
      expect(mockDb.state.orders[0].kotCount).toBe(1)

      expect(audit.logAction).toHaveBeenCalledWith(
        'FIRE_KOT',
        'POS_KOT',
        expect.stringContaining('"kotNumber":1'),
        savedKot.id
      )
    })

    it('fires subsequent KOT with only delta items and increments kotNumber', async () => {
      const order: PosOrder = {
        id: 'ord_1',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'open',
        items: [
          { id: 'oi_1', menuItemId: 'm1', nameSnapshot: 'Idli', quantity: 3, unitPrice: 40 }, // was 2, now 3 -> delta 1
          { id: 'oi_2', menuItemId: 'm2', nameSnapshot: 'Dosa', quantity: 1, unitPrice: 60 }, // was 1, now 1 -> delta 0
          { id: 'oi_3', menuItemId: 'm3', nameSnapshot: 'Coffee', quantity: 2, unitPrice: 25 }, // new item -> delta 2
        ],
        kotCount: 1,
        date: '2026-10-15',
        openedBy: 'u_waiter_1',
        createdAt: '',
        updatedAt: '',
      }

      const priorKot: PosKot = {
        id: 'kot_1',
        orderId: 'ord_1',
        branchId: 'b_1',
        kotNumber: 1,
        items: [
          { menuItemId: 'm1', nameSnapshot: 'Idli', quantity: 2 },
          { menuItemId: 'm2', nameSnapshot: 'Dosa', quantity: 1 },
        ],
        status: 'served',
        firedBy: 'u_waiter_1',
        firedAt: '',
        updatedAt: '',
      }

      mockDb.state.orders = [order]
      mockDb.state.kots = [priorKot]

      const res = await fireKot('ord_1')
      expect(res).toEqual({ success: true })
      expect(mockDb.state.kots.length).toBe(2)
      const newKot = mockDb.state.kots[1]
      expect(newKot.kotNumber).toBe(2)
      expect(newKot.items.length).toBe(2)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const idliItem = newKot.items.find((i: any) => i.menuItemId === 'm1')
      expect(idliItem?.quantity).toBe(1) // 3 - 2 = 1

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coffeeItem = newKot.items.find((i: any) => i.menuItemId === 'm3')
      expect(coffeeItem?.quantity).toBe(2)

      // Dosa should NOT be in the new KOT because delta is 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(newKot.items.some((i: any) => i.menuItemId === 'm2')).toBe(false)
    })

    it('rejects fireKot when delta is empty (no new items)', async () => {
      const order: PosOrder = {
        id: 'ord_1',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'open',
        items: [{ id: 'oi_1', menuItemId: 'm1', nameSnapshot: 'Idli', quantity: 2, unitPrice: 40 }],
        kotCount: 1,
        date: '2026-10-15',
        openedBy: 'u_waiter_1',
        createdAt: '',
        updatedAt: '',
      }

      const priorKot: PosKot = {
        id: 'kot_1',
        orderId: 'ord_1',
        branchId: 'b_1',
        kotNumber: 1,
        items: [{ menuItemId: 'm1', nameSnapshot: 'Idli', quantity: 2 }],
        status: 'pending',
        firedBy: 'u_waiter_1',
        firedAt: '',
        updatedAt: '',
      }

      mockDb.state.orders = [order]
      mockDb.state.kots = [priorKot]

      const res = await fireKot('ord_1')
      expect(res).toEqual({ error: 'No new items to send to kitchen' })
    })

    it('rejects fireKot on an order with no items', async () => {
      const order: PosOrder = {
        id: 'ord_1',
        branchId: 'b_1',
        orderType: 'dine-in',
        status: 'open',
        items: [],
        kotCount: 0,
        date: '2026-10-15',
        openedBy: 'u_waiter_1',
        createdAt: '',
        updatedAt: '',
      }

      mockDb.state.orders = [order]

      const res = await fireKot('ord_1')
      expect(res).toEqual({ error: 'Order has no items' })
    })
  })
})
