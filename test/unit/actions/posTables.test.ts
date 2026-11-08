import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as auth from '@/app/actions/auth'
import {
  getTodayPosData,
  createTable,
  renameTable,
  deactivateTable,
} from '@/app/actions/pos'
import { computePosEodData } from '@/lib/posUtils'
import type { PosTable, PosOrder, PosKot } from '@/app/actions/posTypes'

const { mockDb, mockWithDbTransaction } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state: any = {
    tables: [] as any[],
    orders: [] as any[],
    kots: [] as any[],
    menu: [] as any[],
    categories: [] as any[],
    variants: [] as any[],
    branchMenuItems: [] as any[],
    failNext: false,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCollection = (tableName?: string): any[] => {
    if (tableName === 'pos_tables') return state.tables
    if (tableName === 'pos_orders') return state.orders
    if (tableName === 'pos_kots') return state.kots
    if (tableName === 'menu_items') return state.menu
    if (tableName === 'menu_categories') return state.categories
    if (tableName === 'menu_item_variants') return state.variants
    if (tableName === 'branch_menu_items') return state.branchMenuItems
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filterItem = (tableName: string, item: any, str: string): boolean => {
    if (str.includes('<>') && str.includes(`"${item.id}"`)) return false
    if (tableName === 'pos_tables') {
      if (str.includes('"b_1"') && item.branchId !== 'b_1') return false
      if (str.includes('"b_2"') && item.branchId !== 'b_2') return false
      if (!str.includes('<>')) {
        if (str.includes('"ptbl_1"') && item.id !== 'ptbl_1') return false
        if (str.includes('"ptbl_2"') && item.id !== 'ptbl_2') return false
      }
      if (str.includes('"is_active"') && str.includes('true') && !item.isActive) return false
      if (str.includes('"deleted_at"') && item.deletedAt) return false
      if (str.toLowerCase().includes('"table 2"') && item.name?.toLowerCase() !== 'table 2') return false
      return true
    }
    if (tableName === 'pos_orders') {
      if (str.includes('"open"') && item.status !== 'open') return false
      if (str.includes('"ptbl_1"') && item.tableId !== 'ptbl_1') return false
      if (str.includes('"b_1"') && item.branchId !== 'b_1') return false
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      if (str.includes(`"${today}"`) && item.date !== today) return false
      return true
    }
    if (tableName === 'pos_kots') {
      if (str.includes('"b_1"') && item.branchId !== 'b_1') return false
      if (str.includes('"o1"') && item.orderId !== 'o1') return false
      return true
    }
    if (tableName === 'menu_items') {
      if (str.includes('"is_active"') && str.includes('true') && !item.isActive) return false
      return true
    }
    if (tableName === 'menu_item_variants') {
      if (str.includes('"is_active"') && str.includes('true') && !item.isActive) return false
      return true
    }
    if (tableName === 'branch_menu_items') {
      if (str.includes('"b_1"') && item.branchId !== 'b_1') return false
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
          orderBy: vi.fn((_col: any) => {
            filtered = [...filtered].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
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
            if (filterItem(table?.tableName || '', item, str) || str.includes(`"${item.id}"`)) {
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
  menuItems: {
    tableName: 'menu_items',
    id: { name: 'id' },
    name: { name: 'name' },
    basePrice: { name: 'base_price' },
    categoryId: { name: 'category_id' },
    isActive: { name: 'is_active' },
    dietary: { name: 'dietary' },
    prepTimeMins: { name: 'prep_time_mins' },
    deletedAt: { name: 'deleted_at' },
  },
  menuCategories: {
    tableName: 'menu_categories',
    id: { name: 'id' },
    name: { name: 'name' },
    deletedAt: { name: 'deleted_at' },
  },
  menuItemVariants: {
    tableName: 'menu_item_variants',
    id: { name: 'id' },
    menuItemId: { name: 'menu_item_id' },
    name: { name: 'name' },
    basePrice: { name: 'base_price' },
    isActive: { name: 'is_active' },
    deletedAt: { name: 'deleted_at' },
  },
  branchMenuItems: {
    tableName: 'branch_menu_items',
    branchId: { name: 'branch_id' },
    menuItemId: { name: 'menu_item_id' },
    variantId: { name: 'variant_id' },
    price: { name: 'price' },
    isAvailable: { name: 'is_available' },
  },
}))

vi.mock('@/lib/audit', () => ({
  logAction: vi.fn().mockResolvedValue(true),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('POS Tables & EOD Pure Functions (Tasks 4.1, 4.2, 4.3, 4.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.state.tables = []
    mockDb.state.orders = []
    mockDb.state.kots = []
    mockDb.state.menu = []
    mockDb.state.categories = []
    mockDb.state.variants = []
    mockDb.state.branchMenuItems = []
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

  // ─── 4.1 computePosEodData ─────────────────────────────────────────
  describe('computePosEodData', () => {
    it('computes correct aggregates for mixed status orders', () => {
      const orders: PosOrder[] = [
        // Paid dine-in
        {
          id: 'o1',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'paid',
          items: [],
          kotCount: 1,
          date: '2026-10-15',
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
          bill: { subtotal: 500, discount: 50, gst: 25, totalPayable: 475, generatedAt: '' },
          payment: { method: 'split', cashAmount: 200, upiAmount: 275, paidAt: '' },
        },
        // Paid takeaway
        {
          id: 'o2',
          branchId: 'b_1',
          orderType: 'takeaway',
          status: 'paid',
          items: [],
          kotCount: 1,
          date: '2026-10-15',
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
          bill: { subtotal: 300, discount: 0, gst: 15, totalPayable: 315, generatedAt: '' },
          payment: { method: 'upi', cashAmount: 0, upiAmount: 315, paidAt: '' },
        },
        // Open order — should NOT contribute to revenue
        {
          id: 'o3',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'open',
          items: [],
          kotCount: 0,
          date: '2026-10-15',
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
        },
        // Voided order — should contribute to voids count only
        {
          id: 'o4',
          branchId: 'b_1',
          orderType: 'dine-in',
          status: 'voided',
          items: [],
          kotCount: 0,
          date: '2026-10-15',
          openedBy: 'u1',
          createdAt: '',
          updatedAt: '',
          void: { reason: 'Customer changed mind', voidedBy: 'u_admin', voidedAt: '' },
        },
      ]

      const result = computePosEodData(orders)

      expect(result.billCount).toBe(2)
      expect(result.dineInCovers).toBe(1)
      expect(result.takeawayOrders).toBe(1)
      expect(result.dineInCash).toBe(200)
      expect(result.dineInUpi).toBe(275)
      expect(result.takeawayCash).toBe(0)
      expect(result.takeawayUpi).toBe(315)
      expect(result.totalBillAmount).toBe(790) // 475 + 315
      expect(result.cashCollectedAsBilled).toBe(200)
      expect(result.upiCollectedAsBilled).toBe(590) // 275 + 315
      expect(result.voids).toBe(1)
      expect(result.discounts).toBe(50)
      expect(result.gstCollected).toBe(40) // 25 + 15
    })

    it('returns all zeros for empty orders array', () => {
      const result = computePosEodData([])
      expect(result).toEqual({
        dineInCash: 0,
        dineInUpi: 0,
        takeawayCash: 0,
        takeawayUpi: 0,
        totalBillAmount: 0,
        billCount: 0,
        dineInCovers: 0,
        takeawayOrders: 0,
        cashCollectedAsBilled: 0,
        upiCollectedAsBilled: 0,
        voids: 0,
        discounts: 0,
        gstCollected: 0,
      })
    })
  })

  // ─── 4.2 getTodayPosData ───────────────────────────────────────────
  describe('getTodayPosData', () => {
    it('returns tables, orders, kots, and catalog assembled correctly', async () => {
      mockDb.state.tables = [
        { id: 't2', branchId: 'b_1', name: 'Table 2', isActive: true, createdAt: '', updatedAt: '' },
        { id: 't1', branchId: 'b_1', name: 'Table 1', isActive: true, createdAt: '', updatedAt: '' },
        { id: 't3', branchId: 'b_1', name: 'Table 3', isActive: false, createdAt: '', updatedAt: '' }, // inactive
        { id: 't_other', branchId: 'b_2', name: 'Table Other', isActive: true, createdAt: '', updatedAt: '' }, // other branch
      ]

      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      mockDb.state.orders = [
        { id: 'o1', branchId: 'b_1', date: today, orderType: 'dine-in', status: 'open', items: [], kotCount: 0, openedBy: 'u1', createdAt: '', updatedAt: '' },
        { id: 'o_old', branchId: 'b_1', date: '2020-01-01', orderType: 'dine-in', status: 'open', items: [], kotCount: 0, openedBy: 'u1', createdAt: '', updatedAt: '' },
      ]

      mockDb.state.kots = [
        { id: 'k1', branchId: 'b_1', orderId: 'o1', kotNumber: 1, items: [], status: 'pending', firedBy: 'u1', firedAt: '', updatedAt: '' },
        { id: 'k_other', branchId: 'b_1', orderId: 'o_other', kotNumber: 1, items: [], status: 'pending', firedBy: 'u1', firedAt: '', updatedAt: '' },
      ]

      mockDb.state.menu = [
        { id: 'm1', name: 'Idli', basePrice: 40, categoryId: 'cat_tiffin', isActive: true, dietary: 'veg' },
        { id: 'm2', name: 'Dosa', basePrice: 60, categoryId: 'cat_tiffin', isActive: true, dietary: 'veg' },
        { id: 'm3', name: 'Vada', basePrice: 30, categoryId: 'cat_tiffin', isActive: false }, // inactive
        { id: 'm4', name: 'Coffee', basePrice: 25, categoryId: 'cat_bev', isActive: true }, // will be disabled in branch
      ]

      mockDb.state.variants = [
        { id: 'v1', menuItemId: 'm2', name: 'Masala', basePrice: 80, isActive: true },
        { id: 'v2', menuItemId: 'm2', name: 'Ghee Roast', basePrice: 90, isActive: false }, // inactive variant
      ]

      mockDb.state.branchMenuItems = [
        { branchId: 'b_1', menuItemId: 'm1', price: 45, isAvailable: true }, // price override
        { branchId: 'b_1', menuItemId: 'm4', price: null, isAvailable: false }, // disabled
        { branchId: 'b_1', menuItemId: 'm2', variantId: 'v1', price: 85, isAvailable: true }, // variant override
      ]

      const result = await getTodayPosData('b_1')
      expect('error' in result).toBe(false)
      if ('error' in result) return

      // Tables should be sorted A-Z and only active for branch
      expect(result.tables.map((t: any) => t.name)).toEqual(['Table 1', 'Table 2'])

      // Orders only today
      expect(result.orders.map((o: any) => o.id)).toEqual(['o1'])

      // Kots only for today's orders
      expect(result.kots.map((k: any) => k.id)).toEqual(['k1'])

      // Catalog items:
      const catalogNames = result.catalog.map((c: any) => c.name)
      expect(catalogNames).toContain('Idli')
      expect(catalogNames).toContain('Dosa')
      expect(catalogNames).toContain('Dosa - Masala')
      expect(catalogNames).not.toContain('Coffee')
      expect(catalogNames).not.toContain('Vada')

      const idli = result.catalog.find((c: any) => c.name === 'Idli')
      expect(idli?.effectivePrice).toBe(45)

      const dosa = result.catalog.find((c: any) => c.name === 'Dosa' && !c.variantId)
      expect(dosa?.effectivePrice).toBe(60)

      const masalaDosa = result.catalog.find((c: any) => c.variantId === 'v1')
      expect(masalaDosa?.effectivePrice).toBe(85)
    })

    it('rejects unauthorized or branch-denied access', async () => {
      vi.mocked(auth.getSession).mockResolvedValueOnce(null)
      const res1 = await getTodayPosData('b_1')
      expect(res1).toEqual({ error: 'Unauthorized' })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager', branchId: 'b_1' } as any)
      vi.mocked(auth.requireBranchAccess).mockRejectedValueOnce(new Error('Forbidden'))
      const res2 = await getTodayPosData('b_2')
      expect(res2).toEqual({ error: 'BranchAccessDenied' })
    })
  })

  // ─── 4.3 Table Management (createTable, renameTable, deactivateTable)
  describe('createTable', () => {
    it('creates a new table within limit', async () => {
      mockDb.state.tables = [
        { id: 'ptbl_1', branchId: 'b_1', name: 'Table 1', isActive: true, createdAt: '', updatedAt: '' },
      ]

      const fd = new FormData()
      fd.set('name', 'Table 2')
      fd.set('branchId', 'b_1')

      const res = await createTable({}, fd)
      expect(res).toEqual({ success: true })
      expect(mockDb.state.tables.length).toBe(2)
      expect(mockDb.state.tables[1].name).toBe('Table 2')
      expect(mockDb.state.tables[1].id).toBeTruthy()
      expect(mockDb.state.tables[1].isActive).toBe(true)
    })

    it('creates a table marked as AC', async () => {
      mockDb.state.tables = []
      const fd = new FormData()
      fd.set('name', 'AC Table 1')
      fd.set('branchId', 'b_1')
      fd.set('isAc', 'true')

      const res = await createTable({}, fd)
      expect(res).toEqual({ success: true })
      expect(mockDb.state.tables[0].isAc).toBe(true)
    })

    it('enforces role restriction (billing/kitchen/waiter forbidden)', async () => {
      for (const role of ['billing', 'kitchen', 'waiter', 'readonly']) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(auth.getSession).mockResolvedValueOnce({ role, isGlobalAdmin: false } as any)
        const fd = new FormData()
        fd.set('name', 'T1')
        fd.set('branchId', 'b_1')
        const res = await createTable({}, fd)
        expect(res).toEqual({ error: 'Forbidden' })
      }
    })

    it('enforces 50 active tables limit per branch', async () => {
      const existingTables: PosTable[] = []
      for (let i = 1; i <= 50; i++) {
        existingTables.push({
          id: `ptbl_${i}`,
          branchId: 'b_1',
          name: `Table ${i}`,
          isActive: true,
          createdAt: '',
          updatedAt: '',
        })
      }
      mockDb.state.tables = existingTables

      const fd = new FormData()
      fd.set('name', 'Table 51')
      fd.set('branchId', 'b_1')

      const res = await createTable({}, fd)
      expect(res).toEqual({ error: 'Active table limit (50) reached' })
    })

    it('rejects duplicate table name case-insensitively within branch', async () => {
      mockDb.state.tables = [
        { id: 'ptbl_1', branchId: 'b_1', name: 'Table 1', isActive: true, createdAt: '', updatedAt: '' },
      ]

      const fd = new FormData()
      fd.set('name', 'table 1') // lower-case
      fd.set('branchId', 'b_1')

      const res = await createTable({}, fd)
      expect(res).toEqual({ error: 'A table with this name already exists' })
    })

    it('validates name length (1 to 50 chars)', async () => {
      const fdEmpty = new FormData()
      fdEmpty.set('name', '   ')
      fdEmpty.set('branchId', 'b_1')
      const resEmpty = await createTable({}, fdEmpty)
      expect(resEmpty).toEqual({ error: 'Table name is required' })

      const fdLong = new FormData()
      fdLong.set('name', 'A'.repeat(51))
      fdLong.set('branchId', 'b_1')
      const resLong = await createTable({}, fdLong)
      expect(resLong).toEqual({ error: 'Table name must be at most 50 characters' })
    })
  })

  describe('renameTable', () => {
    it('renames table successfully', async () => {
      mockDb.state.tables = [
        { id: 'ptbl_1', branchId: 'b_1', name: 'Table 1', isActive: true, createdAt: '', updatedAt: '' },
      ]

      const fd = new FormData()
      fd.set('tableId', 'ptbl_1')
      fd.set('newName', 'VIP Table')
      fd.set('branchId', 'b_1')

      const res = await renameTable({}, fd)
      expect(res).toEqual({ success: true })
      expect(mockDb.state.tables[0].name).toBe('VIP Table')
    })

    it('renames table and updates AC flag', async () => {
      mockDb.state.tables = [
        { id: 'ptbl_1', branchId: 'b_1', name: 'Table 1', isAc: false, isActive: true, createdAt: '', updatedAt: '' },
      ]

      const fd = new FormData()
      fd.set('tableId', 'ptbl_1')
      fd.set('newName', 'Table 1 AC')
      fd.set('branchId', 'b_1')
      fd.set('isAc', 'true')

      const res = await renameTable({}, fd)
      expect(res).toEqual({ success: true })
      expect(mockDb.state.tables[0].name).toBe('Table 1 AC')
      expect(mockDb.state.tables[0].isAc).toBe(true)
    })

    it('rejects rename if new name conflicts with existing table', async () => {
      mockDb.state.tables = [
        { id: 'ptbl_1', branchId: 'b_1', name: 'Table 1', isActive: true, createdAt: '', updatedAt: '' },
        { id: 'ptbl_2', branchId: 'b_1', name: 'Table 2', isActive: true, createdAt: '', updatedAt: '' },
      ]

      const fd = new FormData()
      fd.set('tableId', 'ptbl_1')
      fd.set('newName', 'table 2') // conflicts with ptbl_2
      fd.set('branchId', 'b_1')

      const res = await renameTable({}, fd)
      expect(res).toEqual({ error: 'A table with this name already exists' })
    })
  })

  describe('deactivateTable', () => {
    it('soft-deletes table when no open orders exist', async () => {
      mockDb.state.tables = [
        { id: 'ptbl_1', branchId: 'b_1', name: 'Table 1', isActive: true, createdAt: '', updatedAt: '' },
      ]
      mockDb.state.orders = [] // no open orders

      const res = await deactivateTable('ptbl_1')
      expect(res).toEqual({ success: true })
      expect(mockDb.state.tables[0].isActive).toBe(false)
      expect(mockDb.state.tables[0].deletedAt).toBeDefined()
    })

    it('rejects deactivation when table has an active open order', async () => {
      mockDb.state.tables = [
        { id: 'ptbl_1', branchId: 'b_1', name: 'Table 1', isActive: true, createdAt: '', updatedAt: '' },
      ]
      mockDb.state.orders = [
        { id: 'o1', tableId: 'ptbl_1', status: 'open' },
      ]

      const res = await deactivateTable('ptbl_1')
      expect(res).toEqual({ error: 'Table has an active open order and cannot be deactivated' })
    })
  })
})
