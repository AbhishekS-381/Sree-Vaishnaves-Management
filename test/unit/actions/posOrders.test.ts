import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'
import * as audit from '@/lib/audit'
import {
  createOrder,
  addOrUpdateOrderItem,
  removeOrderItem,
  updateOrderNote,
  fireKot,
} from '@/app/actions/pos'
import type { PosOrder, PosKot } from '@/app/actions/posTypes'

vi.mock('@/lib/db', () => ({
  readJSON: vi.fn(),
  withTransaction: vi.fn(),
  readBranchMenuItems: vi.fn(),
  DB_FILES: {
    POS_TABLES: 'pos_tables.json',
    POS_ORDERS: 'pos_orders.json',
    POS_KOTS: 'pos_kots.json',
    MENU: 'menu.json',
    MENU_ITEM_VARIANTS: 'menu_item_variants.json',
  },
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
    vi.spyOn(auth, 'getSession').mockResolvedValue({
      userId: 'u_waiter_1',
      role: 'waiter',
      isGlobalAdmin: false,
      branchId: 'b_1',
    } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b_1')
  })

  // ─── createOrder ───────────────────────────────────────────────────
  describe('createOrder', () => {
    it('creates a dine-in order with tableId and default covers', async () => {
      let savedOrders: PosOrder[] = []
      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb: any) => {
        savedOrders = (await cb([])) as PosOrder[]
        return true
      })

      const fd = new FormData()
      fd.set('orderType', 'dine-in')
      fd.set('branchId', 'b_1')
      fd.set('tableId', 'ptbl_1')
      fd.set('covers', '2')

      const res = await createOrder({}, fd)
      expect(res).toEqual({ success: true })
      expect(savedOrders.length).toBe(1)
      expect(savedOrders[0].orderType).toBe('dine-in')
      expect(savedOrders[0].tableId).toBe('ptbl_1')
      expect(savedOrders[0].covers).toBe(2)
      expect(savedOrders[0].status).toBe('open')
      expect(savedOrders[0].openedBy).toBe('u_waiter_1')
      expect(savedOrders[0].id.startsWith('pord_')).toBe(true)

      expect(audit.logAction).toHaveBeenCalledWith(
        'CREATE_POS_ORDER',
        'POS_ORDER',
        expect.stringContaining('"orderType":"dine-in"'),
        savedOrders[0].id
      )
    })

    it('creates a takeaway order with sequential T-N number and no tableId', async () => {
      let savedOrders: PosOrder[] = []
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      const existingOrders: PosOrder[] = [
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

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb: any) => {
        savedOrders = (await cb([...existingOrders])) as PosOrder[]
        return true
      })

      const fd = new FormData()
      fd.set('orderType', 'takeaway')
      fd.set('branchId', 'b_1')

      const res = await createOrder({}, fd)
      expect(res).toEqual({ success: true })
      expect(savedOrders.length).toBe(2)
      expect(savedOrders[1].takeawayNumber).toBe('T-2')
      expect(savedOrders[1].tableId).toBeUndefined()
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
      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
        await cb([
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
        ])
        return true
      })

      const fd = new FormData()
      fd.set('orderType', 'dine-in')
      fd.set('branchId', 'b_1')
      fd.set('tableId', 'ptbl_1')

      const res = await createOrder({}, fd)
      expect(res).toEqual({ error: 'Table already has an open order' })
    })

    it('denies billing or kitchen role from creating orders', async () => {
      vi.mocked(auth.getSession).mockResolvedValueOnce({
        role: 'billing',
        isGlobalAdmin: false,
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
      let savedOrders: PosOrder[] = []
      const existing: PosOrder = {
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

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb: any) => {
        savedOrders = (await cb([existing])) as PosOrder[]
        return true
      })

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
      expect(savedOrders[0].items.length).toBe(1)
      expect(savedOrders[0].items[0].nameSnapshot).toBe('Idli')
      expect(savedOrders[0].items[0].quantity).toBe(2)
      expect(savedOrders[0].items[0].unitPrice).toBe(40)
      expect(savedOrders[0].items[0].note).toBe('Extra sambar')
    })

    it('updates quantity and note of existing item while keeping unitPrice immutable', async () => {
      let savedOrders: PosOrder[] = []
      const existing: PosOrder = {
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
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb: any) => {
        savedOrders = (await cb([existing])) as PosOrder[]
        return true
      })

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
      expect(savedOrders[0].items[0].quantity).toBe(4)
      expect(savedOrders[0].items[0].unitPrice).toBe(40) // IMMUTABLE!
      expect(savedOrders[0].items[0].note).toBe('No spicy')
    })

    it('rejects edit by different waiter (waiter ownership isolation)', async () => {
      const existing: PosOrder = {
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
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
        await cb([existing])
        return true
      })

      // Current session is u_waiter_1
      const res = await addOrUpdateOrderItem('ord_1', 'item_idli', 1, 40, 'Idli')
      expect(res).toEqual({ error: 'Forbidden: waiters can only edit their own orders' })
    })

    it('allows manager to edit waiter order', async () => {
      vi.mocked(auth.getSession).mockResolvedValueOnce({
        userId: 'u_mgr',
        role: 'manager',
        isGlobalAdmin: false,
        branchId: 'b_1',
      } as any)

      let savedOrders: PosOrder[] = []
      const existing: PosOrder = {
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
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb: any) => {
        savedOrders = (await cb([existing])) as PosOrder[]
        return true
      })

      const res = await addOrUpdateOrderItem('ord_1', 'item_idli', 1, 40, 'Idli')
      expect(res).toEqual({ success: true })
      expect(savedOrders[0].items.length).toBe(1)
    })
  })

  // ─── removeOrderItem ───────────────────────────────────────────────
  describe('removeOrderItem', () => {
    it('removes item from open order', async () => {
      let savedOrders: PosOrder[] = []
      const existing: PosOrder = {
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
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb: any) => {
        savedOrders = (await cb([existing])) as PosOrder[]
        return true
      })

      const res = await removeOrderItem('ord_1', 'oi_1')
      expect(res).toEqual({ success: true })
      expect(savedOrders[0].items.length).toBe(1)
      expect(savedOrders[0].items[0].id).toBe('oi_2')
    })

    it('rejects removal from non-open order', async () => {
      const existing: PosOrder = {
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
      }

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
        await cb([existing])
        return true
      })

      const res = await removeOrderItem('ord_1', 'oi_1')
      expect(res).toEqual({ error: 'Order is not open' })
    })
  })

  // ─── updateOrderNote ───────────────────────────────────────────────
  describe('updateOrderNote', () => {
    it('updates order-level note', async () => {
      let savedOrders: PosOrder[] = []
      const existing: PosOrder = {
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

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb: any) => {
        savedOrders = (await cb([existing])) as PosOrder[]
        return true
      })

      const res = await updateOrderNote('ord_1', 'Table requested corner seating')
      expect(res).toEqual({ success: true })
      expect(savedOrders[0].note).toBe('Table requested corner seating')
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

      vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
        if (file === 'pos_orders.json') return [order]
        if (file === 'pos_kots.json') return [] // no prior KOTs
        return []
      })

      let savedKots: PosKot[] = []
      vi.mocked(db.withTransaction).mockImplementation(async (file: string, cb: any) => {
        if (file === 'pos_kots.json') {
          savedKots = await cb([])
          return true
        }
        if (file === 'pos_orders.json') {
          await cb([order])
          return true
        }
        return true
      })

      const res = await fireKot('ord_1')
      expect(res).toEqual({ success: true })
      expect(savedKots.length).toBe(1)
      expect(savedKots[0].kotNumber).toBe(1)
      expect(savedKots[0].status).toBe('pending')
      expect(savedKots[0].items.length).toBe(2)
      expect(savedKots[0].items[0].quantity).toBe(2)
      expect(savedKots[0].items[0].nameSnapshot).toBe('Idli')
      expect(savedKots[0].items[0].note).toBe('Spicy')
      expect(order.kotCount).toBe(1)

      expect(audit.logAction).toHaveBeenCalledWith(
        'FIRE_KOT',
        'POS_KOT',
        expect.stringContaining('"kotNumber":1'),
        savedKots[0].id
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

      vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
        if (file === 'pos_orders.json') return [order]
        if (file === 'pos_kots.json') return [priorKot]
        return []
      })

      let savedKots: PosKot[] = []
      vi.mocked(db.withTransaction).mockImplementation(async (file: string, cb: any) => {
        if (file === 'pos_kots.json') {
          savedKots = await cb([priorKot])
          return true
        }
        if (file === 'pos_orders.json') {
          await cb([order])
          return true
        }
        return true
      })

      const res = await fireKot('ord_1')
      expect(res).toEqual({ success: true })
      expect(savedKots.length).toBe(2)
      const newKot = savedKots[1]
      expect(newKot.kotNumber).toBe(2)
      expect(newKot.items.length).toBe(2)

      const idliItem = newKot.items.find(i => i.menuItemId === 'm1')
      expect(idliItem?.quantity).toBe(1) // 3 - 2 = 1

      const coffeeItem = newKot.items.find(i => i.menuItemId === 'm3')
      expect(coffeeItem?.quantity).toBe(2)

      // Dosa should NOT be in the new KOT because delta is 0
      expect(newKot.items.some(i => i.menuItemId === 'm2')).toBe(false)
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

      vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
        if (file === 'pos_orders.json') return [order]
        if (file === 'pos_kots.json') return [priorKot]
        return []
      })

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

      vi.mocked(db.readJSON).mockImplementation(async () => [order])

      const res = await fireKot('ord_1')
      expect(res).toEqual({ error: 'Order has no items' })
    })
  })
})
