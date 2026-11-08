import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getTodayPosData,
  addOrUpdateOrderItem,
  removeOrderItem,
  fireKot,
  generateBill,
  recordPayment,
  reopenOrder,
  voidOrder,
} from '@/app/actions/pos'

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
    if (tableName === 'pos_orders') {
      if (str.includes(`"${item.id}"`)) return true
      return true
    }
    if (tableName === 'pos_kots') {
      if (str.includes(`"${item.orderId}"`)) return true
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
      if (str.includes('"br-1"') && item.branchId !== 'br-1') return false
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
  posTables: { tableName: 'pos_tables', name: { name: 'name' } },
  posOrders: { tableName: 'pos_orders', id: { name: 'id' }, date: { name: 'date' } },
  posKots: { tableName: 'pos_kots', id: { name: 'id' }, orderId: { name: 'order_id' } },
  menuItems: { tableName: 'menu_items', id: { name: 'id' }, isActive: { name: 'is_active' } },
  menuCategories: { tableName: 'menu_categories', id: { name: 'id' }, name: { name: 'name' } },
  menuItemVariants: { tableName: 'menu_item_variants', id: { name: 'id' }, isActive: { name: 'is_active' } },
  branchMenuItems: { tableName: 'branch_menu_items', branchId: { name: 'branch_id' } },
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

describe('POS Multi-Variant Menu & Branch Pricing Matrix - posVariantsPricing.test.ts', () => {
  const managerSession = { userId: 'u_mgr', name: 'Manager Bob', role: 'manager', isGlobalAdmin: false, branchId: 'br-1' }

  const sampleMenuItems = [
    { id: 'm_biryani', name: 'Hyderabadi Biryani', basePrice: 200, categoryId: 'Rice', isActive: true, dietary: 'veg' },
    { id: 'm_dosa', name: 'Masala Dosa', basePrice: 90, categoryId: 'Tiffin', isActive: true, dietary: 'veg' },
    { id: 'm_inactive', name: 'Seasonal Kheer', basePrice: 80, categoryId: 'Dessert', isActive: false },
  ]

  const sampleVariants = [
    // Biryani variants
    { id: 'v_half', menuItemId: 'm_biryani', name: 'Half (Serves 1)', basePrice: 130, isActive: true },
    { id: 'v_full', menuItemId: 'm_biryani', name: 'Full (Serves 2)', basePrice: 240, isActive: true },
    { id: 'v_family', menuItemId: 'm_biryani', name: 'Family Pack', basePrice: 500, isActive: false }, // inactive variant
    // Inactive parent variants (should be excluded)
    { id: 'v_kheer_large', menuItemId: 'm_inactive', name: 'Large Cup', basePrice: 120, isActive: true },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.state.tables = []
    mockDb.state.orders = []
    mockDb.state.kots = []
    mockDb.state.menu = [...sampleMenuItems]
    mockDb.state.categories = [
      { id: 'Rice', name: 'Rice' },
      { id: 'Tiffin', name: 'Tiffin' },
      { id: 'Dessert', name: 'Dessert' },
    ]
    mockDb.state.variants = [...sampleVariants]
    mockDb.state.branchMenuItems = []

    authMocks.getSession.mockResolvedValue(managerSession)
    authMocks.requireBranchAccess.mockImplementation(async (bId?: string) => bId || 'br-1')
    auditMocks.logAction.mockResolvedValue(undefined)
  })

  // =========================================================================
  // 1. Variant Catalog Resolution in getTodayPosData
  // =========================================================================
  describe('Catalog Variant Resolution in getTodayPosData', () => {
    it('populates catalog with base item and its active variants', async () => {
      const res = await getTodayPosData('br-1')
      expect('catalog' in res).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catalog = (res as any).catalog

      // Base items: m_biryani, m_dosa
      // Active variants: v_half, v_full (v_family is inactive, v_kheer_large parent is inactive)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(catalog.some((c: any) => c.menuItemId === 'm_biryani' && !c.variantId)).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(catalog.some((c: any) => c.menuItemId === 'm_dosa')).toBe(true)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const halfVariant = catalog.find((c: any) => c.variantId === 'v_half')
      expect(halfVariant).toBeDefined()
      expect(halfVariant.name).toBe('Hyderabadi Biryani - Half (Serves 1)')
      expect(halfVariant.effectivePrice).toBe(130)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fullVariant = catalog.find((c: any) => c.variantId === 'v_full')
      expect(fullVariant).toBeDefined()
      expect(fullVariant.name).toBe('Hyderabadi Biryani - Full (Serves 2)')
      expect(fullVariant.effectivePrice).toBe(240)

      // Inactive variant excluded
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(catalog.some((c: any) => c.variantId === 'v_family')).toBe(false)
      // Inactive parent item and its variant excluded
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(catalog.some((c: any) => c.menuItemId === 'm_inactive')).toBe(false)
    })

    it('applies branch-level price override on variants', async () => {
      // Branch overrides variant price for v_half from 130 to 150
      mockDb.state.branchMenuItems = [
        { branchId: 'br-1', menuItemId: 'm_biryani', variantId: 'v_half', isAvailable: true, price: 150 },
      ]

      const res = await getTodayPosData('br-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catalog = (res as any).catalog
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const halfVariant = catalog.find((c: any) => c.variantId === 'v_half')

      expect(halfVariant.effectivePrice).toBe(150)
      // v_full still has default 240
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fullVariant = catalog.find((c: any) => c.variantId === 'v_full')
      expect(fullVariant.effectivePrice).toBe(240)
    })

    it('excludes variant when branch marks variant isAvailable as false', async () => {
      mockDb.state.branchMenuItems = [
        { branchId: 'br-1', menuItemId: 'm_biryani', variantId: 'v_full', isAvailable: false, price: null },
      ]

      const res = await getTodayPosData('br-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catalog = (res as any).catalog

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(catalog.some((c: any) => c.variantId === 'v_full')).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(catalog.some((c: any) => c.variantId === 'v_half')).toBe(true)
    })

    it('excludes variants when parent item is marked unavailable at branch level', async () => {
      mockDb.state.branchMenuItems = [
        { branchId: 'br-1', menuItemId: 'm_biryani', isAvailable: false, price: null },
      ]

      const res = await getTodayPosData('br-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catalog = (res as any).catalog

      // Neither parent nor its variants should appear in catalog
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(catalog.some((c: any) => c.menuItemId === 'm_biryani')).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(catalog.some((c: any) => c.variantId === 'v_half')).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(catalog.some((c: any) => c.variantId === 'v_full')).toBe(false)
    })
  })

  // =========================================================================
  // 2. Order Cart Operations with Variants
  // =========================================================================
  describe('Cart Operations with Multiple Variants of Same Dish', () => {
    it('allows adding multiple distinct variants of the same item to an order', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: [] as any[],
      }]

      // Add Biryani - Half
      const res1 = await addOrUpdateOrderItem('ord-1', 'm_biryani', 2, 130, 'Hyderabadi Biryani - Half', 'v_half')
      expect(res1.success).toBe(true)

      // Add Biryani - Full to the same order
      const res2 = await addOrUpdateOrderItem('ord-1', 'm_biryani', 1, 240, 'Hyderabadi Biryani - Full', 'v_full')
      expect(res2.success).toBe(true)

      expect(mockDb.state.orders[0].items).toHaveLength(2)
      expect(mockDb.state.orders[0].items[0].variantId).toBe('v_half')
      expect(mockDb.state.orders[0].items[0].quantity).toBe(2)
      expect(mockDb.state.orders[0].items[1].variantId).toBe('v_full')
      expect(mockDb.state.orders[0].items[1].quantity).toBe(1)
    })

    it('updating quantity on one variant does not mutate the other variant', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [
          { id: 'i-half', menuItemId: 'm_biryani', variantId: 'v_half', quantity: 2, unitPrice: 130, nameSnapshot: 'Biryani Half' },
          { id: 'i-full', menuItemId: 'm_biryani', variantId: 'v_full', quantity: 1, unitPrice: 240, nameSnapshot: 'Biryani Full' },
        ],
      }]

      // Update Biryani - Half quantity to 5
      const res = await addOrUpdateOrderItem('ord-1', 'm_biryani', 5, 130, 'Biryani Half', 'v_half')
      expect(res.success).toBe(true)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const halfItem = mockDb.state.orders[0].items.find((i: any) => i.variantId === 'v_half')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fullItem = mockDb.state.orders[0].items.find((i: any) => i.variantId === 'v_full')

      expect(halfItem?.quantity).toBe(5)
      expect(fullItem?.quantity).toBe(1) // Unchanged
    })

    it('removes one variant from cart while leaving the other variant intact', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [
          { id: 'i-half', menuItemId: 'm_biryani', variantId: 'v_half', quantity: 2, unitPrice: 130 },
          { id: 'i-full', menuItemId: 'm_biryani', variantId: 'v_full', quantity: 1, unitPrice: 240 },
        ],
      }]

      const res = await removeOrderItem('ord-1', 'i-half')
      expect(res.success).toBe(true)

      expect(mockDb.state.orders[0].items).toHaveLength(1)
      expect(mockDb.state.orders[0].items[0].id).toBe('i-full')
      expect(mockDb.state.orders[0].items[0].variantId).toBe('v_full')
    })
  })

  // =========================================================================
  // 3. Firing KOT with Variants
  // =========================================================================
  describe('Firing KOT with Variants', () => {
    it('fires KOT preserving variantId and nameSnapshot on KotItem', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [
          { menuItemId: 'm_biryani', variantId: 'v_half', quantity: 3, nameSnapshot: 'Hyderabadi Biryani - Half', note: 'Extra raita' },
          { menuItemId: 'm_biryani', variantId: 'v_full', quantity: 1, nameSnapshot: 'Hyderabadi Biryani - Full' },
        ],
      }]
      mockDb.state.kots = []

      const res = await fireKot('ord-1')
      expect(res.success).toBe(true)
      expect(mockDb.state.kots).toHaveLength(1)
      const createdKot = mockDb.state.kots[0]
      expect(createdKot.items).toHaveLength(2)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kotHalf = createdKot.items.find((k: any) => k.variantId === 'v_half')
      expect(kotHalf.quantity).toBe(3)
      expect(kotHalf.nameSnapshot).toBe('Hyderabadi Biryani - Half')
      expect(kotHalf.note).toBe('Extra raita')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kotFull = createdKot.items.find((k: any) => k.variantId === 'v_full')
      expect(kotFull.quantity).toBe(1)
      expect(kotFull.nameSnapshot).toBe('Hyderabadi Biryani - Full')
    })

    it('computes delta independently for each variant of the same dish', async () => {
      mockDb.state.orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [
          // Prior: 2 Half, 1 Full. Now: 4 Half, 1 Full (only Half incremented)
          { menuItemId: 'm_biryani', variantId: 'v_half', quantity: 4, nameSnapshot: 'Biryani Half' },
          { menuItemId: 'm_biryani', variantId: 'v_full', quantity: 1, nameSnapshot: 'Biryani Full' },
        ],
      }]
      mockDb.state.kots = [{
        id: 'kot-prior-1',
        orderId: 'ord-1',
        kotNumber: 1,
        items: [
          { menuItemId: 'm_biryani', variantId: 'v_half', quantity: 2 },
          { menuItemId: 'm_biryani', variantId: 'v_full', quantity: 1 },
        ],
      }]

      const res = await fireKot('ord-1')
      expect(res.success).toBe(true)
      // Only the delta for Half should be fired (4 - 2 = 2)
      expect(mockDb.state.kots).toHaveLength(2)
      const newKot = mockDb.state.kots[1]
      expect(newKot.items).toHaveLength(1)
      expect(newKot.items[0].variantId).toBe('v_half')
      expect(newKot.items[0].quantity).toBe(2)
    })
  })

  // =========================================================================
  // 4. Billing, Settlement & Voids with Variants
  // =========================================================================
  describe('Billing, Settlement & Voids with Variants', () => {
    it('computes order subtotal accurately across multiple variants', async () => {
      mockDb.state.orders = [{
        id: 'ord-v-bill',
        branchId: 'br-1',
        status: 'open',
        items: [
          { id: 'i1', menuItemId: 'm_biryani', variantId: 'v_half', quantity: 3, unitPrice: 130 }, // 390
          { id: 'i2', menuItemId: 'm_biryani', variantId: 'v_full', quantity: 2, unitPrice: 240 }, // 480
        ],
      }]

      const fd = new FormData()
      fd.set('orderId', 'ord-v-bill')
      fd.set('discount', '70')
      fd.set('gst', '40')

      const res = await generateBill(null, fd)
      expect(res.success).toBe(true)
      // Subtotal = 390 + 480 = 870. Total = 870 - 70 + 40 = 840
      expect(mockDb.state.orders[0].bill?.subtotal).toBe(870)
      expect(mockDb.state.orders[0].bill?.totalPayable).toBe(840)
      expect(mockDb.state.orders[0].status).toBe('billed')
    })

    it('settles payment for an order with variant items', async () => {
      mockDb.state.orders = [{
        id: 'ord-v-paid',
        branchId: 'br-1',
        status: 'billed',
        items: [
          { id: 'i1', menuItemId: 'm_biryani', variantId: 'v_half', quantity: 1, unitPrice: 130 },
        ],
        bill: { subtotal: 130, discount: 0, gst: 10, totalPayable: 140 },
      }]

      const fd = new FormData()
      fd.set('orderId', 'ord-v-paid')
      fd.set('method', 'cash')
      fd.set('cashTendered', '200')

      const res = await recordPayment(null, fd)
      expect(res.success).toBe(true)
      expect(res.changeDue).toBe(60) // 200 - 140 = 60
      expect(mockDb.state.orders[0].status).toBe('paid')
    })

    it('reopens a billed variant order preserving all variants intact', async () => {
      mockDb.state.orders = [{
        id: 'ord-v-reopen',
        branchId: 'br-1',
        status: 'billed',
        items: [
          { id: 'i1', menuItemId: 'm_biryani', variantId: 'v_half', quantity: 2, unitPrice: 130 },
          { id: 'i2', menuItemId: 'm_biryani', variantId: 'v_full', quantity: 1, unitPrice: 240 },
        ],
        bill: { subtotal: 500, totalPayable: 500 },
      }]

      const res = await reopenOrder('ord-v-reopen')
      expect(res.success).toBe(true)
      expect(mockDb.state.orders[0].status).toBe('open')
      expect(mockDb.state.orders[0].items).toHaveLength(2)
      expect(mockDb.state.orders[0].items[0].variantId).toBe('v_half')
      expect(mockDb.state.orders[0].items[1].variantId).toBe('v_full')
    })

    it('voids an open order containing variants with audit tracking', async () => {
      mockDb.state.orders = [{
        id: 'ord-v-void',
        branchId: 'br-1',
        status: 'open',
        items: [
          { id: 'i1', menuItemId: 'm_biryani', variantId: 'v_half', quantity: 1, unitPrice: 130 },
        ],
      }]

      const fd = new FormData()
      fd.set('orderId', 'ord-v-void')
      fd.set('reason', 'Table cancelled variant order')

      const res = await voidOrder(null, fd)
      expect(res.success).toBe(true)
      expect(mockDb.state.orders[0].status).toBe('voided')
      expect(mockDb.state.orders[0].void?.reason).toBe('Table cancelled variant order')
    })

    it('variant effective price uses basePrice when branch price is null', async () => {
      // Branch row exists but price is null (should fallback to variant basePrice 130)
      mockDb.state.branchMenuItems = [
        { branchId: 'br-1', menuItemId: 'm_biryani', variantId: 'v_half', isAvailable: true, price: null },
      ]

      const res = await getTodayPosData('br-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catalog = (res as any).catalog
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const halfVariant = catalog.find((c: any) => c.variantId === 'v_half')
      expect(halfVariant.effectivePrice).toBe(130)
    })

    it('handles dietary tags and prepTime from parent menu item onto variant catalog item', async () => {
      mockDb.state.menu = [{ ...sampleMenuItems[0], prepTimeMins: 25 }]
      mockDb.state.variants = [sampleVariants[0]]
      mockDb.state.branchMenuItems = []

      const res = await getTodayPosData('br-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catalog = (res as any).catalog
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const halfVariant = catalog.find((c: any) => c.variantId === 'v_half')

      expect(halfVariant.dietary).toBe('veg')
      expect(halfVariant.prepTimeMins).toBe(25)
      expect(halfVariant.categoryId).toBe('Rice')
    })
  })
})
