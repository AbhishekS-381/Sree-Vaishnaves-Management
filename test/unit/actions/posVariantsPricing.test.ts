import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getTodayPosData,
  addOrUpdateOrderItem,
  removeOrderItem,
  fireKot,
} from '@/app/actions/pos'
import { DB_FILES, readBranchMenuItems } from '@/lib/db'

// Mocks
const { authMocks, dbMocks, auditMocks } = vi.hoisted(() => ({
  authMocks: {
    getSession: vi.fn(),
    requireBranchAccess: vi.fn(),
  },
  dbMocks: {
    readJSON: vi.fn(),
    withTransaction: vi.fn(),
    readBranchMenuItems: vi.fn(),
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
  readBranchMenuItems: dbMocks.readBranchMenuItems,
  DB_FILES: {
    MENU: 'menu.json',
    MENU_ITEM_VARIANTS: 'menu_item_variants.json',
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
    authMocks.getSession.mockResolvedValue(managerSession)
    authMocks.requireBranchAccess.mockImplementation(async (bId?: string) => bId || 'br-1')
    auditMocks.logAction.mockResolvedValue(undefined)
  })

  // =========================================================================
  // 1. Variant Catalog Resolution in getTodayPosData
  // =========================================================================
  describe('Catalog Variant Resolution in getTodayPosData', () => {
    it('populates catalog with base item and its active variants', async () => {
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.MENU) return sampleMenuItems
        if (file === DB_FILES.MENU_ITEM_VARIANTS) return sampleVariants
        return []
      })
      dbMocks.readBranchMenuItems.mockResolvedValue([])

      const res = await getTodayPosData('br-1')
      expect('catalog' in res).toBe(true)
      const catalog = (res as any).catalog

      // Base items: m_biryani, m_dosa
      // Active variants: v_half, v_full (v_family is inactive, v_kheer_large parent is inactive)
      expect(catalog.some((c: any) => c.menuItemId === 'm_biryani' && !c.variantId)).toBe(true)
      expect(catalog.some((c: any) => c.menuItemId === 'm_dosa')).toBe(true)

      const halfVariant = catalog.find((c: any) => c.variantId === 'v_half')
      expect(halfVariant).toBeDefined()
      expect(halfVariant.name).toBe('Hyderabadi Biryani - Half (Serves 1)')
      expect(halfVariant.effectivePrice).toBe(130)

      const fullVariant = catalog.find((c: any) => c.variantId === 'v_full')
      expect(fullVariant).toBeDefined()
      expect(fullVariant.name).toBe('Hyderabadi Biryani - Full (Serves 2)')
      expect(fullVariant.effectivePrice).toBe(240)

      // Inactive variant excluded
      expect(catalog.some((c: any) => c.variantId === 'v_family')).toBe(false)
      // Inactive parent item and its variant excluded
      expect(catalog.some((c: any) => c.menuItemId === 'm_inactive')).toBe(false)
    })

    it('applies branch-level price override on variants', async () => {
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.MENU) return sampleMenuItems
        if (file === DB_FILES.MENU_ITEM_VARIANTS) return sampleVariants
        return []
      })

      // Branch overrides variant price for v_half from 130 to 150
      dbMocks.readBranchMenuItems.mockResolvedValue([
        { branchId: 'br-1', menuItemId: 'm_biryani', variantId: 'v_half', isAvailable: true, price: 150 },
      ])

      const res = await getTodayPosData('br-1')
      const catalog = (res as any).catalog
      const halfVariant = catalog.find((c: any) => c.variantId === 'v_half')

      expect(halfVariant.effectivePrice).toBe(150)
      // v_full still has default 240
      const fullVariant = catalog.find((c: any) => c.variantId === 'v_full')
      expect(fullVariant.effectivePrice).toBe(240)
    })

    it('excludes variant when branch marks variant isAvailable as false', async () => {
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.MENU) return sampleMenuItems
        if (file === DB_FILES.MENU_ITEM_VARIANTS) return sampleVariants
        return []
      })

      dbMocks.readBranchMenuItems.mockResolvedValue([
        { branchId: 'br-1', menuItemId: 'm_biryani', variantId: 'v_full', isAvailable: false, price: null },
      ])

      const res = await getTodayPosData('br-1')
      const catalog = (res as any).catalog

      expect(catalog.some((c: any) => c.variantId === 'v_full')).toBe(false)
      expect(catalog.some((c: any) => c.variantId === 'v_half')).toBe(true)
    })

    it('excludes variants when parent item is marked unavailable at branch level', async () => {
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.MENU) return sampleMenuItems
        if (file === DB_FILES.MENU_ITEM_VARIANTS) return sampleVariants
        return []
      })

      // Parent item m_biryani marked unavailable at branch
      dbMocks.readBranchMenuItems.mockResolvedValue([
        { branchId: 'br-1', menuItemId: 'm_biryani', isAvailable: false, price: null },
      ])

      const res = await getTodayPosData('br-1')
      const catalog = (res as any).catalog

      // Neither parent nor its variants should appear in catalog
      expect(catalog.some((c: any) => c.menuItemId === 'm_biryani')).toBe(false)
      expect(catalog.some((c: any) => c.variantId === 'v_half')).toBe(false)
      expect(catalog.some((c: any) => c.variantId === 'v_full')).toBe(false)
    })
  })

  // =========================================================================
  // 2. Order Cart Operations with Variants
  // =========================================================================
  describe('Cart Operations with Multiple Variants of Same Dish', () => {
    it('allows adding multiple distinct variants of the same item to an order', async () => {
      const orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [] as any[],
      }]

      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      // Add Biryani - Half
      const res1 = await addOrUpdateOrderItem('ord-1', 'm_biryani', 2, 130, 'Hyderabadi Biryani - Half', 'v_half')
      expect(res1.success).toBe(true)

      // Add Biryani - Full to the same order
      const res2 = await addOrUpdateOrderItem('ord-1', 'm_biryani', 1, 240, 'Hyderabadi Biryani - Full', 'v_full')
      expect(res2.success).toBe(true)

      expect(orders[0].items).toHaveLength(2)
      expect(orders[0].items[0].variantId).toBe('v_half')
      expect(orders[0].items[0].quantity).toBe(2)
      expect(orders[0].items[1].variantId).toBe('v_full')
      expect(orders[0].items[1].quantity).toBe(1)
    })

    it('updating quantity on one variant does not mutate the other variant', async () => {
      const orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [
          { id: 'i-half', menuItemId: 'm_biryani', variantId: 'v_half', quantity: 2, unitPrice: 130, nameSnapshot: 'Biryani Half' },
          { id: 'i-full', menuItemId: 'm_biryani', variantId: 'v_full', quantity: 1, unitPrice: 240, nameSnapshot: 'Biryani Full' },
        ],
      }]

      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      // Update Biryani - Half quantity to 5
      const res = await addOrUpdateOrderItem('ord-1', 'm_biryani', 5, 130, 'Biryani Half', 'v_half')
      expect(res.success).toBe(true)

      const halfItem = orders[0].items.find(i => i.variantId === 'v_half')
      const fullItem = orders[0].items.find(i => i.variantId === 'v_full')

      expect(halfItem?.quantity).toBe(5)
      expect(fullItem?.quantity).toBe(1) // Unchanged
    })

    it('removes one variant from cart while leaving the other variant intact', async () => {
      const orders = [{
        id: 'ord-1',
        branchId: 'br-1',
        status: 'open',
        openedBy: 'u_mgr',
        items: [
          { id: 'i-half', menuItemId: 'm_biryani', variantId: 'v_half', quantity: 2, unitPrice: 130 },
          { id: 'i-full', menuItemId: 'm_biryani', variantId: 'v_full', quantity: 1, unitPrice: 240 },
        ],
      }]

      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const res = await removeOrderItem('ord-1', 'i-half')
      expect(res.success).toBe(true)

      expect(orders[0].items).toHaveLength(1)
      expect(orders[0].items[0].id).toBe('i-full')
      expect(orders[0].items[0].variantId).toBe('v_full')
    })
  })

  // =========================================================================
  // 3. Firing KOT with Variants
  // =========================================================================
  describe('Firing KOT with Variants', () => {
    it('fires KOT preserving variantId and nameSnapshot on KotItem', async () => {
      let createdKot: any = null
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.POS_ORDERS) {
          return [{
            id: 'ord-1',
            branchId: 'br-1',
            status: 'open',
            openedBy: 'u_mgr',
            items: [
              { menuItemId: 'm_biryani', variantId: 'v_half', quantity: 3, nameSnapshot: 'Hyderabadi Biryani - Half', note: 'Extra raita' },
              { menuItemId: 'm_biryani', variantId: 'v_full', quantity: 1, nameSnapshot: 'Hyderabadi Biryani - Full' },
            ],
          }]
        }
        if (file === DB_FILES.POS_KOTS) return []
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
      expect(createdKot.items).toHaveLength(2)

      const kotHalf = createdKot.items.find((k: any) => k.variantId === 'v_half')
      expect(kotHalf.quantity).toBe(3)
      expect(kotHalf.nameSnapshot).toBe('Hyderabadi Biryani - Half')
      expect(kotHalf.note).toBe('Extra raita')

      const kotFull = createdKot.items.find((k: any) => k.variantId === 'v_full')
      expect(kotFull.quantity).toBe(1)
      expect(kotFull.nameSnapshot).toBe('Hyderabadi Biryani - Full')
    })

    it('computes delta independently for each variant of the same dish', async () => {
      let createdKot: any = null
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.POS_ORDERS) {
          return [{
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
        }
        if (file === DB_FILES.POS_KOTS) {
          return [{
            id: 'kot-prior-1',
            orderId: 'ord-1',
            kotNumber: 1,
            items: [
              { menuItemId: 'm_biryani', variantId: 'v_half', quantity: 2 },
              { menuItemId: 'm_biryani', variantId: 'v_full', quantity: 1 },
            ],
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
      // Only the delta for Half should be fired (4 - 2 = 2)
      expect(createdKot.items).toHaveLength(1)
      expect(createdKot.items[0].variantId).toBe('v_half')
      expect(createdKot.items[0].quantity).toBe(2)
    })
  })

  // =========================================================================
  // 4. Billing, Settlement & Voids with Variants
  // =========================================================================
  describe('Billing, Settlement & Voids with Variants', () => {
    it('computes order subtotal accurately across multiple variants', async () => {
      const { generateBill } = await import('@/app/actions/pos')
      const orders = [{
        id: 'ord-v-bill',
        branchId: 'br-1',
        status: 'open',
        items: [
          { id: 'i1', menuItemId: 'm_biryani', variantId: 'v_half', quantity: 3, unitPrice: 130 }, // 390
          { id: 'i2', menuItemId: 'm_biryani', variantId: 'v_full', quantity: 2, unitPrice: 240 }, // 480
        ],
      }]

      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const fd = new FormData()
      fd.set('orderId', 'ord-v-bill')
      fd.set('discount', '70')
      fd.set('gst', '40')

      const res = await generateBill(null, fd)
      expect(res.success).toBe(true)
      // Subtotal = 390 + 480 = 870. Total = 870 - 70 + 40 = 840
      expect(orders[0].bill?.subtotal).toBe(870)
      expect(orders[0].bill?.totalPayable).toBe(840)
      expect(orders[0].status).toBe('billed')
    })

    it('settles payment for an order with variant items', async () => {
      const { recordPayment } = await import('@/app/actions/pos')
      const orders = [{
        id: 'ord-v-paid',
        branchId: 'br-1',
        status: 'billed',
        items: [
          { id: 'i1', menuItemId: 'm_biryani', variantId: 'v_half', quantity: 1, unitPrice: 130 },
        ],
        bill: { subtotal: 130, discount: 0, gst: 10, totalPayable: 140 },
      }]

      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const fd = new FormData()
      fd.set('orderId', 'ord-v-paid')
      fd.set('method', 'cash')
      fd.set('cashTendered', '200')

      const res = await recordPayment(null, fd)
      expect(res.success).toBe(true)
      expect(res.changeDue).toBe(60) // 200 - 140 = 60
      expect(orders[0].status).toBe('paid')
    })

    it('reopens a billed variant order preserving all variants intact', async () => {
      const { reopenOrder } = await import('@/app/actions/pos')
      const orders = [{
        id: 'ord-v-reopen',
        branchId: 'br-1',
        status: 'billed',
        items: [
          { id: 'i1', menuItemId: 'm_biryani', variantId: 'v_half', quantity: 2, unitPrice: 130 },
          { id: 'i2', menuItemId: 'm_biryani', variantId: 'v_full', quantity: 1, unitPrice: 240 },
        ],
        bill: { subtotal: 500, totalPayable: 500 },
      }]

      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const res = await reopenOrder('ord-v-reopen')
      expect(res.success).toBe(true)
      expect(orders[0].status).toBe('open')
      expect(orders[0].items).toHaveLength(2)
      expect(orders[0].items[0].variantId).toBe('v_half')
      expect(orders[0].items[1].variantId).toBe('v_full')
    })

    it('voids an open order containing variants with audit tracking', async () => {
      const { voidOrder } = await import('@/app/actions/pos')
      const orders = [{
        id: 'ord-v-void',
        branchId: 'br-1',
        status: 'open',
        items: [
          { id: 'i1', menuItemId: 'm_biryani', variantId: 'v_half', quantity: 1, unitPrice: 130 },
        ],
      }]

      dbMocks.withTransaction.mockImplementation(async (file: string, callback: any) => {
        const copy = [...orders]
        callback(copy)
        return true
      })

      const fd = new FormData()
      fd.set('orderId', 'ord-v-void')
      fd.set('reason', 'Table cancelled variant order')

      const res = await voidOrder(null, fd)
      expect(res.success).toBe(true)
      expect(orders[0].status).toBe('voided')
      expect(orders[0].void?.reason).toBe('Table cancelled variant order')
    })

    it('variant effective price uses basePrice when branch price is null', async () => {
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.MENU) return sampleMenuItems
        if (file === DB_FILES.MENU_ITEM_VARIANTS) return sampleVariants
        return []
      })

      // Branch row exists but price is null (should fallback to variant basePrice 130)
      dbMocks.readBranchMenuItems.mockResolvedValue([
        { branchId: 'br-1', menuItemId: 'm_biryani', variantId: 'v_half', isAvailable: true, price: null },
      ])

      const res = await getTodayPosData('br-1')
      const catalog = (res as any).catalog
      const halfVariant = catalog.find((c: any) => c.variantId === 'v_half')
      expect(halfVariant.effectivePrice).toBe(130)
    })

    it('handles dietary tags and prepTime from parent menu item onto variant catalog item', async () => {
      dbMocks.readJSON.mockImplementation(async (file: string) => {
        if (file === DB_FILES.MENU) return [{ ...sampleMenuItems[0], prepTimeMins: 25 }]
        if (file === DB_FILES.MENU_ITEM_VARIANTS) return [sampleVariants[0]]
        return []
      })
      dbMocks.readBranchMenuItems.mockResolvedValue([])

      const res = await getTodayPosData('br-1')
      const catalog = (res as any).catalog
      const halfVariant = catalog.find((c: any) => c.variantId === 'v_half')

      expect(halfVariant.dietary).toBe('veg')
      expect(halfVariant.prepTimeMins).toBe(25)
      expect(halfVariant.categoryId).toBe('Rice')
    })
  })
})

