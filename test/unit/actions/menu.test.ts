import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as actions from '@/app/actions/menu'
import * as auth from '@/app/actions/auth'
import * as audit from '@/lib/audit'

const { mockDb, mockWithDbTransaction } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state: any = {
    items: [],
    branchItems: [],
    branches: [],
    variants: [],
    priceHistory: [],
    failNextTx: false,
    failNextOp: false,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    state,
    get items() { return state.items },
    get branchItems() { return state.branchItems },
    get variants() { return state.variants },
    get priceHistory() { return state.priceHistory },
    get branches() { return state.branches },

    select: vi.fn((fields?: any) => ({
      from: vi.fn((table: any) => {
        let collection: any[] = []
        if (table?.tableName === 'menu_items') collection = state.items
        else if (table?.tableName === 'branch_menu_items') collection = state.branchItems
        else if (table?.tableName === 'branches') collection = state.branches
        else if (table?.tableName === 'menu_item_variants') collection = state.variants
        else if (table?.tableName === 'menu_price_history') collection = state.priceHistory

        let filtered = collection
        const builder: any = {
          where: vi.fn((cond?: any) => {
            if (cond) {
              const str = JSON.stringify(cond)
              filtered = collection.filter((item: any) => {
                if (str.includes('<>') && str.includes(`"${item.id}"`)) {
                  return false
                }
                if (str.includes('"nope"')) {
                  return false
                }
                if (table?.tableName === 'branch_menu_items' && item.menuItemId) {
                  if (str.includes('"m1"') && item.menuItemId !== 'm1') return false
                  if (str.includes('"m2"') && item.menuItemId !== 'm2') return false
                }
                return true
              })
            }
            return builder
          }),
          orderBy: vi.fn((_order?: any) => builder),
          limit: vi.fn((count?: number) => {
            const res = count !== undefined ? filtered.slice(0, count) : filtered
            if (fields && fields.count) {
              return Promise.resolve([{ count: filtered.length }])
            }
            return Promise.resolve(res)
          }),
          then: (resolve: any, reject: any) => {
            if (fields && fields.count) {
              return Promise.resolve([{ count: filtered.length }]).then(resolve, reject)
            }
            return Promise.resolve(filtered).then(resolve, reject)
          },
          catch: (fn: any) => Promise.resolve(filtered).catch(fn),
        }
        return builder
      }),
    })),

    insert: vi.fn((table: any) => ({
      values: vi.fn((val: any) => {
        if (state.failNextOp) throw new Error('db op failed')
        const entries = Array.isArray(val) ? val : [val]
        if (table?.tableName === 'menu_items') state.items.push(...entries)
        else if (table?.tableName === 'branch_menu_items') state.branchItems.push(...entries)
        else if (table?.tableName === 'branches') state.branches.push(...entries)
        else if (table?.tableName === 'menu_item_variants') state.variants.push(...entries)
        else if (table?.tableName === 'menu_price_history') state.priceHistory.push(...entries)
        return Promise.resolve([])
      }),
    })),

    update: vi.fn((table: any) => ({
      set: vi.fn((setVal: any) => ({
        where: vi.fn((cond?: any) => {
          if (state.failNextOp) throw new Error('db op failed')
          let collection: any[] = []
          if (table?.tableName === 'menu_items') collection = state.items
          else if (table?.tableName === 'branch_menu_items') collection = state.branchItems
          else if (table?.tableName === 'menu_item_variants') collection = state.variants

          if (cond) {
            const str = JSON.stringify(cond)
            const target = collection.find((item: any) => str.includes(`"${item.id}"`))
            if (target) {
              Object.assign(target, setVal)
              return Promise.resolve([])
            }
          }

          if (collection.length > 0) {
            Object.assign(collection[0], setVal)
          }
          return Promise.resolve([])
        }),
      })),
    })),

    delete: vi.fn((table: any) => ({
      where: vi.fn((_cond?: any) => {
        if (state.failNextOp) throw new Error('db op failed')
        if (table?.tableName === 'menu_price_history') {
          state.priceHistory = []
        }
        return Promise.resolve([])
      }),
    })),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockWithTx = vi.fn().mockImplementation(async (cb: any) => {
    if (state.failNextTx) throw new Error('Transaction failed')
    return cb(mock)
  })

  return { mockDb: mock, mockWithDbTransaction: mockWithTx }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  menuItems: { tableName: 'menu_items', id: 'id', name: 'name', categoryId: 'categoryId', basePrice: 'basePrice', isActive: 'isActive', deletedAt: 'deletedAt', sortOrder: 'sortOrder' },
  branchMenuItems: { tableName: 'branch_menu_items', id: 'id', branchId: 'branchId', menuItemId: 'menuItemId', variantId: 'variantId', price: 'price', isAvailable: 'isAvailable' },
  menuItemVariants: { tableName: 'menu_item_variants', id: 'id', menuItemId: 'menuItemId', name: 'name', basePrice: 'basePrice', sortOrder: 'sortOrder', isActive: 'isActive', deletedAt: 'deletedAt' },
  menuPriceHistory: { tableName: 'menu_price_history', pk: 'pk', id: 'id', menuItemId: 'menuItemId', variantId: 'variantId', branchId: 'branchId', scope: 'scope', oldPrice: 'oldPrice', newPrice: 'newPrice' },
  branches: { tableName: 'branches', id: 'id', isActive: 'isActive', deletedAt: 'deletedAt' },
  withDbTransaction: mockWithDbTransaction,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAction: vi.fn().mockResolvedValue(true) }))
vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn(),
  getSessionRole: vi.fn(),
  requireBranchAccess: vi.fn(),
}))

const fd = (values: Record<string, string | string[]>) => ({
  get: (k: string) => {
    const v = values[k]
    if (v === undefined) return null
    return Array.isArray(v) ? (v[0] ?? null) : v
  },
  getAll: (k: string) => {
    const v = values[k]
    if (v === undefined) return []
    return Array.isArray(v) ? v : [v]
  },
  entries: () => Object.entries(values)[Symbol.iterator](),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as FormData)

const asOwner = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(auth.getSession).mockResolvedValue({
    userId: 'u1',
    name: 'Owner',
    role: 'owner',
    isGlobalAdmin: true,
    isGlobalOwner: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

const asManager = (branchId = 'b1') =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(auth.getSession).mockResolvedValue({
    userId: 'u2',
    name: 'Mgr',
    role: 'manager',
    isGlobalAdmin: false,
    branchId,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

const validItem = { name: 'Masala Dosa', categoryId: 'c1', basePrice: '80' }

describe('Menu Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.state.items = []
    mockDb.state.branchItems = []
    mockDb.state.branches = [{ id: 'b1', isActive: true }, { id: 'b2', isActive: true }]
    mockDb.state.variants = []
    mockDb.state.priceHistory = []
    mockDb.state.failNextTx = false
    mockDb.state.failNextOp = false

    asOwner()
    vi.mocked(auth.requireBranchAccess).mockImplementation(async (b?: string) => b || 'b1')
    mockWithDbTransaction.mockImplementation(async (cb: any) => {
      if (mockDb.state.failNextTx) throw new Error('Transaction failed')
      return cb(mockDb)
    })
  })

  // ─── addMenuItem ────────────────────────────────────────────────────────────
  describe('addMenuItem', () => {
    it('rejects a non-global-admin', async () => {
      asManager()
      const res = await actions.addMenuItem({}, fd(validItem))
      expect(res).toEqual({ error: 'Forbidden: Admin or Owner access required' })
    })

    it('validates required fields', async () => {
      const res = await actions.addMenuItem({}, fd({}))
      expect(res.error).toBeDefined()
    })

    it('rejects a malformed image URL', async () => {
      const res = await actions.addMenuItem({}, fd({ ...validItem, imageUrl: 'not-a-url' }))
      expect(res).toEqual({ error: 'Image URL must be a valid URL' })
    })

    it('rejects duplicate name within category', async () => {
      mockDb.state.items = [{ id: 'm1', name: 'Masala Dosa', categoryId: 'c1', isActive: true }]
      const res = await actions.addMenuItem({}, fd(validItem))
      expect(res).toEqual({ error: 'A menu item with this name already exists in this category' })
    })

    it('creates item and seeds branch mappings in active branches', async () => {
      const res = await actions.addMenuItem({}, fd(validItem))
      expect(res).toEqual({ success: true })
      expect(mockDb.items.length).toBe(1)
      expect(mockDb.items[0]).toMatchObject({ name: 'Masala Dosa', categoryId: 'c1', basePrice: 80, isActive: true })
      expect(mockDb.branchItems.map((b: any) => b.branchId)).toEqual(['b1', 'b2'])
      expect(audit.logAction).toHaveBeenCalledWith(
        'CREATE_MENU_ITEM', 'MENU_ITEM', expect.any(String), expect.any(String)
      )
    })

    it('persists optional metadata and availability window', async () => {
      const res = await actions.addMenuItem(
        {},
        fd({
          ...validItem,
          description: 'Crispy',
          costPrice: '30',
          dietary: ['jain', 'vegan'],
          spiceLevel: '2',
          prepTimeMins: '12',
          isSignature: 'on',
          availStart: '06:00',
          availEnd: '11:00',
          availDays: ['1', '2'],
        })
      )
      expect(res).toEqual({ success: true })
      expect(mockDb.items[0]).toMatchObject({
        description: 'Crispy',
        costPrice: 30,
        dietary: ['jain', 'vegan'],
        spiceLevel: 2,
        prepTimeMins: 12,
        isSignature: true,
        availability: { days: [1, 2], startTime: '06:00', endTime: '11:00' },
      })
    })

    it('returns error when transaction fails', async () => {
      mockDb.state.failNextTx = true
      const res = await actions.addMenuItem({}, fd(validItem))
      expect(res).toEqual({ error: 'Failed to add menu item' })
    })
  })

  // ─── updateMenuItem ─────────────────────────────────────────────────────────
  describe('updateMenuItem', () => {
    it('rejects a non-global-admin', async () => {
      asManager()
      const res = await actions.updateMenuItem({}, fd({ id: 'm1', ...validItem }))
      expect(res).toEqual({ error: 'Forbidden: Admin or Owner access required' })
    })

    it('validates id', async () => {
      const res = await actions.updateMenuItem({}, fd(validItem))
      expect(res.error).toBeDefined()
    })

    it('returns not found for unknown id', async () => {
      mockDb.state.items = []
      const res = await actions.updateMenuItem({}, fd({ id: 'nope', ...validItem }))
      expect(res).toEqual({ error: 'Menu item not found' })
    })

    it('updates fields and warns on category change', async () => {
      mockDb.state.items = [{ id: 'm1', name: 'Old', categoryId: 'c1', basePrice: 80, isActive: true }]
      const res = await actions.updateMenuItem({}, fd({ id: 'm1', name: 'New Name', categoryId: 'c2', basePrice: '95' }))
      expect(res).toMatchObject({ success: true, warning: expect.stringMatching(/chef specialty/i) })
      expect(mockDb.items[0].name).toBe('New Name')
      expect(mockDb.items[0].basePrice).toBe(95)
      expect(audit.logAction).toHaveBeenCalledWith('UPDATE_MENU_ITEM', 'MENU_ITEM', expect.any(String), 'm1')
    })
  })

  // ─── delete / restore / reorder ─────────────────────────────────────────────
  describe('delete / restore / reorder', () => {
    it('deleteMenuItem soft-deletes item', async () => {
      mockDb.state.items = [{ id: 'm1', name: 'A', isActive: true }]
      const res = await actions.deleteMenuItem('m1')
      expect(res).toEqual({ success: true })
      expect(mockDb.items[0].isActive).toBe(false)
      expect(mockDb.items[0].deletedAt).toBeDefined()
    })

    it('deleteMenuItem returns not found', async () => {
      mockDb.state.items = []
      expect(await actions.deleteMenuItem('nope')).toEqual({ error: 'Menu item not found' })
    })

    it('restoreMenuItem reactivates item', async () => {
      mockDb.state.items = [{ id: 'm1', name: 'A', isActive: false, deletedAt: new Date() }]
      const res = await actions.restoreMenuItem('m1')
      expect(res).toEqual({ success: true })
      expect(mockDb.items[0].isActive).toBe(true)
      expect(mockDb.items[0].deletedAt).toBeNull()
    })

    it('reorderMenuItems assigns sortOrder', async () => {
      mockDb.state.items = [
        { id: 'a', categoryId: 'c1', sortOrder: 99 },
        { id: 'b', categoryId: 'c1', sortOrder: 5 },
      ]
      const res = await actions.reorderMenuItems('c1', ['b', 'a'])
      expect(res).toEqual({ success: true })
      expect(mockWithDbTransaction).toHaveBeenCalled()
    })

    it('reorderMenuItems rejects empty list and non-admins', async () => {
      expect(await actions.reorderMenuItems('c1', [])).toEqual({ error: 'Nothing to reorder' })
      asManager()
      expect(await actions.reorderMenuItems('c1', ['a'])).toEqual({ error: 'Forbidden: Admin or Owner access required' })
    })
  })

  // ─── variants ───────────────────────────────────────────────────────────────
  describe('variants', () => {
    it('addVariant validates and rejects non-admins', async () => {
      asManager()
      expect(await actions.addVariant('m1', 'Half', 50)).toEqual({ error: 'Forbidden: Admin or Owner access required' })
      asOwner()
      expect((await actions.addVariant('m1', '', 50)).error).toBeDefined()
      expect((await actions.addVariant('m1', 'Half', -1)).error).toBeDefined()
    })

    it('addVariant rejects duplicate name for same item', async () => {
      mockDb.state.variants = [{ id: 'v1', menuItemId: 'm1', name: 'Half', isActive: true }]
      expect(await actions.addVariant('m1', 'Half', 50)).toEqual({ error: 'This item already has a variant with that name' })
    })

    it('addVariant appends variant', async () => {
      mockDb.state.variants = []
      const res = await actions.addVariant('m1', 'Full', 90)
      expect(res).toEqual({ success: true })
      expect(mockDb.variants.length).toBe(1)
      expect(mockDb.variants[0]).toMatchObject({ menuItemId: 'm1', name: 'Full', basePrice: 90, isActive: true })
    })

    it('updateVariant updates variant', async () => {
      mockDb.state.variants = [{ id: 'v1', menuItemId: 'm1', name: 'Half', basePrice: 50, isActive: true }]
      const res = await actions.updateVariant('v1', 'Half Plate', 55)
      expect(res).toEqual({ success: true })
      expect(mockDb.variants[0].name).toBe('Half Plate')
      expect(mockDb.variants[0].basePrice).toBe(55)
    })

    it('deleteVariant soft-deletes variant', async () => {
      mockDb.state.variants = [{ id: 'v1', menuItemId: 'm1', name: 'Half', isActive: true }]
      const res = await actions.deleteVariant('v1')
      expect(res).toEqual({ success: true })
      expect(mockDb.variants[0].isActive).toBe(false)
    })
  })

  // ─── branch availability & price ────────────────────────────────────────────
  describe('branch availability & price', () => {
    it('setBranchItemAvailability requires session', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.getSession).mockResolvedValue(null as any)
      expect(await actions.setBranchItemAvailability('b1', 'm1', true)).toEqual({ error: 'Unauthorized' })
    })

    it('setBranchItemAvailability surfaces branch access error', async () => {
      vi.mocked(auth.requireBranchAccess).mockRejectedValue(new Error('Forbidden: You can only access your assigned branch.'))
      const res = await actions.setBranchItemAvailability('b2', 'm1', true)
      expect(res).toEqual({ error: 'Forbidden: You can only access your assigned branch.' })
    })

    it('setBranchItemAvailability updates existing row', async () => {
      mockDb.state.branchItems = [{ id: 'r1', branchId: 'b1', menuItemId: 'm1', isAvailable: true }]
      const res = await actions.setBranchItemAvailability('b1', 'm1', false)
      expect(res).toEqual({ success: true })
      expect(mockDb.branchItems[0].isAvailable).toBe(false)
    })

    it('setBranchItemAvailability creates row when missing', async () => {
      mockDb.state.branchItems = []
      const res = await actions.setBranchItemAvailability('b1', 'm9', false)
      expect(res).toEqual({ success: true })
      expect(mockDb.branchItems.length).toBe(1)
      expect(mockDb.branchItems[0]).toMatchObject({ branchId: 'b1', menuItemId: 'm9', isAvailable: false })
    })

    it('updateBranchMenuItemPrice updates price', async () => {
      mockDb.state.branchItems = [{ id: 'r1', branchId: 'b1', menuItemId: 'm1', price: null }]
      const res = await actions.updateBranchMenuItemPrice('b1', 'm1', 85)
      expect(res).toEqual({ success: true })
      expect(mockDb.branchItems[0].price).toBe(85)
      expect(audit.logAction).toHaveBeenCalledWith(
        'UPDATE_BRANCH_PRICE', 'BRANCH_MENU_ITEM', expect.any(String), 'm1'
      )
    })
  })

  // ─── bulk operations ────────────────────────────────────────────────────────
  describe('bulk operations', () => {
    it('bulkSetBranchAvailability validates input', async () => {
      expect(await actions.bulkSetBranchAvailability('b1', [], true)).toEqual({ error: 'No items selected' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.getSession).mockResolvedValue(null as any)
      expect(await actions.bulkSetBranchAvailability('b1', ['m1'], true)).toEqual({ error: 'Unauthorized' })
    })

    it('bulkSetBranchAvailability updates existing and creates missing rows', async () => {
      mockDb.state.branchItems = [{ id: 'r1', branchId: 'b1', menuItemId: 'm1', isAvailable: true }]
      const res = await actions.bulkSetBranchAvailability('b1', ['m1', 'm2'], false)
      expect(res).toMatchObject({ success: true, changed: 2 })
    })

    it('bulkUpdateBranchPrices validates mode and value', async () => {
      expect(await actions.bulkUpdateBranchPrices('b1', [], 'percent', 10)).toEqual({ error: 'No items selected' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(await actions.bulkUpdateBranchPrices('b1', ['m1'], 'bogus' as any, 10)).toEqual({ error: 'Invalid price change mode' })
      expect(await actions.bulkUpdateBranchPrices('b1', ['m1'], 'set', -1)).toEqual({ error: 'Price cannot be negative' })
      expect(await actions.bulkUpdateBranchPrices('b1', ['m1'], 'percent', NaN)).toEqual({ error: 'Invalid value' })
    })

    it('bulkUpdateBranchPrices updates prices', async () => {
      mockDb.state.items = [{ id: 'm1', basePrice: 100 }, { id: 'm2', basePrice: 50 }]
      mockDb.state.branchItems = [{ id: 'r1', branchId: 'b1', menuItemId: 'm1', price: null }]
      const res = await actions.bulkUpdateBranchPrices('b1', ['m1', 'm2'], 'percent', 10)
      expect(res).toMatchObject({ success: true, changed: 2 })
    })
  })

  // ─── cloneBranchMenuConfig ──────────────────────────────────────────────────
  describe('cloneBranchMenuConfig', () => {
    it('validates branch pair and options', async () => {
      expect(await actions.cloneBranchMenuConfig('', 'b2')).toEqual({ error: 'Both source and target branches are required' })
      expect(await actions.cloneBranchMenuConfig('b1', 'b1')).toEqual({ error: 'Source and target branches must differ' })
      expect(await actions.cloneBranchMenuConfig('b1', 'b2', { prices: false, availability: false })).toEqual({
        error: 'Select at least prices or availability to copy',
      })
    })

    it('requires session', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.getSession).mockResolvedValue(null as any)
      expect(await actions.cloneBranchMenuConfig('b1', 'b2')).toEqual({ error: 'Unauthorized' })
    })

    it('errors when source branch has no configuration', async () => {
      mockDb.state.branchItems = []
      expect(await actions.cloneBranchMenuConfig('b1', 'b2')).toEqual({
        error: 'Source branch has no menu configuration to copy',
      })
    })

    it('copies prices and availability into target branch', async () => {
      mockDb.state.branchItems = [
        { id: 's1', branchId: 'b1', menuItemId: 'm1', price: 90, isAvailable: false },
        { id: 's2', branchId: 'b1', menuItemId: 'm2', price: null, isAvailable: true },
      ]
      const res = await actions.cloneBranchMenuConfig('b1', 'b2')
      expect(res).toMatchObject({ success: true, applied: 2 })
      expect(mockWithDbTransaction).toHaveBeenCalled()
    })
  })
})
