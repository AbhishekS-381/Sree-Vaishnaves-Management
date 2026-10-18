import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'
import {
  getTodayPosData,
  createTable,
  renameTable,
  deactivateTable,
} from '@/app/actions/pos'
import { computePosEodData } from '@/lib/posUtils'
import type { PosTable, PosOrder, PosKot } from '@/app/actions/posTypes'

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

describe('POS Tables & EOD Pure Functions (Tasks 4.1, 4.2, 4.3, 4.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(auth, 'getSession').mockResolvedValue({
      userId: 'u_admin',
      role: 'admin',
      isGlobalAdmin: true,
      branchId: 'b_1',
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
      const tables: PosTable[] = [
        { id: 't2', branchId: 'b_1', name: 'Table 2', isActive: true, createdAt: '', updatedAt: '' },
        { id: 't1', branchId: 'b_1', name: 'Table 1', isActive: true, createdAt: '', updatedAt: '' },
        { id: 't3', branchId: 'b_1', name: 'Table 3', isActive: false, createdAt: '', updatedAt: '' }, // inactive
        { id: 't_other', branchId: 'b_2', name: 'Table Other', isActive: true, createdAt: '', updatedAt: '' }, // other branch
      ]

      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      const orders: PosOrder[] = [
        { id: 'o1', branchId: 'b_1', date: today, orderType: 'dine-in', status: 'open', items: [], kotCount: 0, openedBy: 'u1', createdAt: '', updatedAt: '' },
        { id: 'o_old', branchId: 'b_1', date: '2020-01-01', orderType: 'dine-in', status: 'open', items: [], kotCount: 0, openedBy: 'u1', createdAt: '', updatedAt: '' },
      ]

      const kots: PosKot[] = [
        { id: 'k1', branchId: 'b_1', orderId: 'o1', kotNumber: 1, items: [], status: 'pending', firedBy: 'u1', firedAt: '', updatedAt: '' },
        { id: 'k_other', branchId: 'b_1', orderId: 'o_other', kotNumber: 1, items: [], status: 'pending', firedBy: 'u1', firedAt: '', updatedAt: '' },
      ]

      const menu = [
        { id: 'm1', name: 'Idli', basePrice: 40, categoryId: 'cat_tiffin', isActive: true, dietary: 'veg' },
        { id: 'm2', name: 'Dosa', basePrice: 60, categoryId: 'cat_tiffin', isActive: true, dietary: 'veg' },
        { id: 'm3', name: 'Vada', basePrice: 30, categoryId: 'cat_tiffin', isActive: false }, // inactive
        { id: 'm4', name: 'Coffee', basePrice: 25, categoryId: 'cat_bev', isActive: true }, // will be disabled in branch
      ]

      const variants = [
        { id: 'v1', menuItemId: 'm2', name: 'Masala', basePrice: 80, isActive: true },
        { id: 'v2', menuItemId: 'm2', name: 'Ghee Roast', basePrice: 90, isActive: false }, // inactive variant
      ]

      const branchMenuItems = [
        { branchId: 'b_1', menuItemId: 'm1', price: 45, isAvailable: true }, // price override
        { branchId: 'b_1', menuItemId: 'm4', price: null, isAvailable: false }, // disabled
        { branchId: 'b_1', menuItemId: 'm2', variantId: 'v1', price: 85, isAvailable: true }, // variant override
      ]

      vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
        if (file === 'pos_tables.json') return tables
        if (file === 'pos_orders.json') return orders
        if (file === 'pos_kots.json') return kots
        if (file === 'menu.json') return menu
        if (file === 'menu_item_variants.json') return variants
        return []
      })
      vi.mocked(db.readBranchMenuItems).mockResolvedValue(branchMenuItems)

      const result = await getTodayPosData('b_1')
      expect('error' in result).toBe(false)
      if ('error' in result) return

      // Tables should be sorted A-Z and only active for branch
      expect(result.tables.map(t => t.name)).toEqual(['Table 1', 'Table 2'])

      // Orders only today
      expect(result.orders.map(o => o.id)).toEqual(['o1'])

      // Kots only for today's orders
      expect(result.kots.map(k => k.id)).toEqual(['k1'])

      // Catalog items:
      // m1: price override 45
      // m2: base price 60
      // m4: excluded (isAvailable: false)
      // m3: excluded (isActive: false)
      // v1: parent m2 + variant v1, price override 85
      const catalogNames = result.catalog.map(c => c.name)
      expect(catalogNames).toContain('Idli')
      expect(catalogNames).toContain('Dosa')
      expect(catalogNames).toContain('Dosa - Masala')
      expect(catalogNames).not.toContain('Coffee')
      expect(catalogNames).not.toContain('Vada')

      const idli = result.catalog.find(c => c.name === 'Idli')
      expect(idli?.effectivePrice).toBe(45)

      const dosa = result.catalog.find(c => c.name === 'Dosa' && !c.variantId)
      expect(dosa?.effectivePrice).toBe(60)

      const masalaDosa = result.catalog.find(c => c.variantId === 'v1')
      expect(masalaDosa?.effectivePrice).toBe(85)
    })

    it('rejects unauthorized or branch-denied access', async () => {
      vi.mocked(auth.getSession).mockResolvedValueOnce(null)
      const res1 = await getTodayPosData('b_1')
      expect(res1).toEqual({ error: 'Unauthorized' })

      vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager', branchId: 'b_1' } as any)
      vi.mocked(auth.requireBranchAccess).mockRejectedValueOnce(new Error('Forbidden'))
      const res2 = await getTodayPosData('b_2')
      expect(res2).toEqual({ error: 'BranchAccessDenied' })
    })
  })

  // ─── 4.3 Table Management (createTable, renameTable, deactivateTable)
  describe('createTable', () => {
    it('creates a new table within limit', async () => {
      let savedTables: PosTable[] = []
      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb: any) => {
        savedTables = (await cb([
          { id: 'ptbl_1', branchId: 'b_1', name: 'Table 1', isActive: true, createdAt: '', updatedAt: '' },
        ])) as PosTable[]
        return true
      })

      const fd = new FormData()
      fd.set('name', 'Table 2')
      fd.set('branchId', 'b_1')

      const res = await createTable({}, fd)
      expect(res).toEqual({ success: true })
      expect(savedTables.length).toBe(2)
      expect(savedTables[1].name).toBe('Table 2')
      expect(savedTables[1].id.startsWith('ptbl_')).toBe(true)
      expect(savedTables[1].isActive).toBe(true)
    })

    it('enforces role restriction (billing/kitchen/waiter forbidden)', async () => {
      for (const role of ['billing', 'kitchen', 'waiter', 'readonly']) {
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

      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
        await cb(existingTables)
        return true
      })

      const fd = new FormData()
      fd.set('name', 'Table 51')
      fd.set('branchId', 'b_1')

      const res = await createTable({}, fd)
      expect(res).toEqual({ error: 'Active table limit (50) reached' })
    })

    it('rejects duplicate table name case-insensitively within branch', async () => {
      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
        await cb([
          { id: 'ptbl_1', branchId: 'b_1', name: 'Table 1', isActive: true, createdAt: '', updatedAt: '' },
        ])
        return true
      })

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
      let savedTables: PosTable[] = []
      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb: any) => {
        savedTables = (await cb([
          { id: 'ptbl_1', branchId: 'b_1', name: 'Table 1', isActive: true, createdAt: '', updatedAt: '' },
        ])) as PosTable[]
        return true
      })

      const fd = new FormData()
      fd.set('tableId', 'ptbl_1')
      fd.set('newName', 'VIP Table')
      fd.set('branchId', 'b_1')

      const res = await renameTable({}, fd)
      expect(res).toEqual({ success: true })
      expect(savedTables[0].name).toBe('VIP Table')
    })

    it('rejects rename if new name conflicts with existing table', async () => {
      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
        await cb([
          { id: 'ptbl_1', branchId: 'b_1', name: 'Table 1', isActive: true, createdAt: '', updatedAt: '' },
          { id: 'ptbl_2', branchId: 'b_1', name: 'Table 2', isActive: true, createdAt: '', updatedAt: '' },
        ])
        return true
      })

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
      const tables: PosTable[] = [
        { id: 'ptbl_1', branchId: 'b_1', name: 'Table 1', isActive: true, createdAt: '', updatedAt: '' },
      ]
      vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
        if (file === 'pos_tables.json') return tables
        if (file === 'pos_orders.json') return [] // no open orders
        return []
      })

      let updatedTables: PosTable[] = []
      vi.mocked(db.withTransaction).mockImplementation(async (_f, cb: any) => {
        updatedTables = (await cb(tables)) as PosTable[]
        return true
      })

      const res = await deactivateTable('ptbl_1')
      expect(res).toEqual({ success: true })
      expect(updatedTables[0].isActive).toBe(false)
      expect(updatedTables[0].deletedAt).toBeDefined()
    })

    it('rejects deactivation when table has an active open order', async () => {
      const tables: PosTable[] = [
        { id: 'ptbl_1', branchId: 'b_1', name: 'Table 1', isActive: true, createdAt: '', updatedAt: '' },
      ]
      const orders = [
        { id: 'o1', tableId: 'ptbl_1', status: 'open' },
      ]
      vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
        if (file === 'pos_tables.json') return tables
        if (file === 'pos_orders.json') return orders
        return []
      })

      const res = await deactivateTable('ptbl_1')
      expect(res).toEqual({ error: 'Table has an active open order and cannot be deactivated' })
    })
  })
})
