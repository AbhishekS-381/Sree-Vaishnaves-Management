import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as actions from '@/app/actions/menu'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'
import * as audit from '@/lib/audit'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  withBranchMenuTransaction: vi.fn(),
  readBranchMenuItems: vi.fn().mockResolvedValue([]),
  branchMenuItemsFile: (b: string) => `branch_menu_items_${b}.json`,
  readJSON: vi.fn().mockResolvedValue([]),
  writeJSON: vi.fn().mockResolvedValue(true),
  DB_FILES: new Proxy({}, { get: (_t, p) => String(p).toLowerCase() + '.json' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAction: vi.fn() }))
vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn(),
  getSessionRole: vi.fn(),
  requireBranchAccess: vi.fn(),
}))

/** Realistic FormData mock: only the keys you provide exist. */
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
}) as unknown as FormData

const asOwner = () => vi.mocked(auth.getSession).mockResolvedValue(
  { userId: 'u1', name: 'Owner', role: 'owner', isGlobalAdmin: true, isGlobalOwner: true } as any
)
const asManager = (branchId = 'b1') => vi.mocked(auth.getSession).mockResolvedValue(
  { userId: 'u2', name: 'Mgr', role: 'manager', isGlobalAdmin: false, branchId } as any
)

/** withTransaction mock that runs the callback over `seed`, capturing per file. */
const runTx = (seed: any[] = [], ok = true) => {
  const captured: { list: any[]; byFile: Record<string, any[]> } = { list: [], byFile: {} }
  vi.mocked(db.withTransaction).mockImplementation(async (file: string, cb: any) => {
    const result = await cb([...seed])
    captured.byFile[file] = result
    // `list` tracks the first (primary) collection touched, so a follow-up
    // price-history write cannot clobber the assertion target.
    if (captured.list.length === 0) captured.list = result
    return ok
  })
  return captured
}
const runBranchTx = (seed: any[] = [], ok = true) => {
  const captured: { list: any[]; branchId: string } = { list: [], branchId: '' }
  vi.mocked(db.withBranchMenuTransaction).mockImplementation(async (branchId: string, cb: any) => {
    captured.branchId = branchId
    captured.list = await cb([...seed])
    return ok
  })
  return captured
}

const validItem = { name: 'Masala Dosa', categoryId: 'c1', basePrice: '80' }

beforeEach(() => {
  vi.clearAllMocks()
  asOwner()
  vi.mocked(auth.requireBranchAccess).mockImplementation(async (b?: string) => b || 'b1')
  vi.mocked(db.readJSON).mockResolvedValue([])
  vi.mocked(db.readBranchMenuItems).mockResolvedValue([])
  vi.mocked(db.withTransaction).mockResolvedValue(true)
  vi.mocked(db.withBranchMenuTransaction).mockResolvedValue(true)
})

describe('menu.ts — addMenuItem', () => {
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

  it('rejects a duplicate name within the same category', async () => {
    runTx([{ id: 'x', name: 'masala dosa', categoryId: 'c1', isActive: true }])
    const res = await actions.addMenuItem({}, fd(validItem))
    expect(res).toEqual({ error: 'A menu item with this name already exists in this category' })
  })

  it('creates the item and seeds a mapping in each active branch shard', async () => {
    const cap = runTx([])
    vi.mocked(db.readJSON).mockResolvedValue([
      { id: 'b1', isActive: true }, { id: 'b2', isActive: true }, { id: 'b3', isActive: false },
    ] as any)
    const seeded: string[] = []
    vi.mocked(db.withBranchMenuTransaction).mockImplementation(async (branchId: string, cb: any) => {
      seeded.push(branchId); await cb([]); return true
    })

    const res = await actions.addMenuItem({}, fd(validItem))
    expect(res).toEqual({ success: true })
    expect(cap.list[0]).toMatchObject({ name: 'Masala Dosa', categoryId: 'c1', basePrice: 80, isActive: true })
    expect(seeded).toEqual(['b1', 'b2'])          // inactive branch skipped
    expect(audit.logAction).toHaveBeenCalledWith(
      'CREATE_MENU_ITEM', 'MENU_ITEM', expect.any(String), expect.any(String)
    )
  })

  it('persists optional metadata and an availability window', async () => {
    const cap = runTx([])
    const res = await actions.addMenuItem({}, fd({
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
    }))
    expect(res).toEqual({ success: true })
    expect(cap.list[0]).toMatchObject({
      description: 'Crispy', costPrice: 30, dietary: ['jain', 'vegan'],
      spiceLevel: 2, prepTimeMins: 12, isSignature: true,
      availability: { days: [1, 2], startTime: '06:00', endTime: '11:00' },
    })
  })

  it('leaves availability undefined when no window fields are given', async () => {
    const cap = runTx([])
    await actions.addMenuItem({}, fd(validItem))
    expect(cap.list[0].availability).toBeUndefined()
  })

  it('returns an error when the transaction fails', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const res = await actions.addMenuItem({}, fd(validItem))
    expect(res).toEqual({ error: 'Failed to add menu item' })
  })
})

describe('menu.ts — updateMenuItem', () => {
  const existing = [{ id: 'm1', name: 'Old', categoryId: 'c1', basePrice: 80, isActive: true }]

  it('rejects a non-global-admin', async () => {
    asManager()
    const res = await actions.updateMenuItem({}, fd({ id: 'm1', ...validItem }))
    expect(res).toEqual({ error: 'Forbidden: Admin or Owner access required' })
  })

  it('validates the id', async () => {
    const res = await actions.updateMenuItem({}, fd(validItem))
    expect(res.error).toBeDefined()
  })

  it('returns not found for an unknown id', async () => {
    runTx(existing)
    const res = await actions.updateMenuItem({}, fd({ id: 'nope', ...validItem }))
    expect(res).toEqual({ error: 'Menu item not found' })
  })

  it('rejects a duplicate name in the same category', async () => {
    runTx([...existing, { id: 'm2', name: 'Masala Dosa', categoryId: 'c1', isActive: true }])
    const res = await actions.updateMenuItem({}, fd({ id: 'm1', ...validItem }))
    expect(res).toEqual({ error: 'A menu item with this name already exists in this category' })
  })

  it('updates fields and records base price history when the price changes', async () => {
    const cap = runTx(existing)
    const res = await actions.updateMenuItem({}, fd({ id: 'm1', name: 'New Name', categoryId: 'c1', basePrice: '95' }))
    expect(res).toEqual({ success: true })
    expect(cap.list.find((m: any) => m.id === 'm1')).toMatchObject({ name: 'New Name', basePrice: 95 })
    // price-history write goes through withTransaction as well
    expect(vi.mocked(db.withTransaction).mock.calls.length).toBeGreaterThan(1)
    expect(audit.logAction).toHaveBeenCalledWith('UPDATE_MENU_ITEM', 'MENU_ITEM', expect.any(String), 'm1')
  })

  it('warns when the category changes', async () => {
    runTx(existing)
    const res = await actions.updateMenuItem({}, fd({ id: 'm1', name: 'Old', categoryId: 'c2', basePrice: '80' }))
    expect(res).toMatchObject({ success: true })
    expect((res as any).warning).toMatch(/chef specialty/i)
  })
})

describe('menu.ts — delete / restore / reorder', () => {
  it('deleteMenuItem soft-deletes and audits', async () => {
    const cap = runTx([{ id: 'm1', name: 'A', isActive: true }])
    const res = await actions.deleteMenuItem('m1')
    expect(res).toEqual({ success: true })
    expect(cap.list[0]).toMatchObject({ isActive: false })
    expect(cap.list[0].deletedAt).toBeDefined()
    expect(audit.logAction).toHaveBeenCalledWith('DELETE_MENU_ITEM', 'MENU_ITEM', expect.any(String), 'm1')
  })

  it('deleteMenuItem returns not found', async () => {
    runTx([])
    expect(await actions.deleteMenuItem('nope')).toEqual({ error: 'Menu item not found' })
  })

  it('deleteMenuItem blocks a manager', async () => {
    asManager()
    expect(await actions.deleteMenuItem('m1')).toEqual({ error: 'Forbidden: Admin or Owner access required' })
  })

  it('restoreMenuItem reactivates and clears deletedAt', async () => {
    const cap = runTx([{ id: 'm1', name: 'A', isActive: false, deletedAt: 'x' }])
    const res = await actions.restoreMenuItem('m1')
    expect(res).toEqual({ success: true })
    expect(cap.list[0]).toMatchObject({ isActive: true, deletedAt: undefined })
  })

  it('restoreMenuItem returns not found', async () => {
    runTx([])
    expect(await actions.restoreMenuItem('nope')).toEqual({ error: 'Menu item not found' })
  })

  it('restoreMenuItem blocks a manager', async () => {
    asManager()
    expect(await actions.restoreMenuItem('m1')).toEqual({ error: 'Forbidden: Admin or Owner access required' })
  })

  it('reorderMenuItems assigns sortOrder by position in one write', async () => {
    const cap = runTx([
      { id: 'a', categoryId: 'c1', sortOrder: 99 },
      { id: 'b', categoryId: 'c1', sortOrder: 5 },
      { id: 'z', categoryId: 'c2', sortOrder: 7 },
    ])
    const res = await actions.reorderMenuItems('c1', ['b', 'a'])
    expect(res).toEqual({ success: true })
    expect(cap.list.find((i: any) => i.id === 'b').sortOrder).toBe(0)
    expect(cap.list.find((i: any) => i.id === 'a').sortOrder).toBe(1)
    expect(cap.list.find((i: any) => i.id === 'z').sortOrder).toBe(7) // other category untouched
    expect(vi.mocked(db.withTransaction)).toHaveBeenCalledTimes(1)     // atomic
  })

  it('reorderMenuItems rejects an empty list and non-admins', async () => {
    expect(await actions.reorderMenuItems('c1', [])).toEqual({ error: 'Nothing to reorder' })
    asManager()
    expect(await actions.reorderMenuItems('c1', ['a'])).toEqual({ error: 'Forbidden: Admin or Owner access required' })
  })
})

describe('menu.ts — variants', () => {
  it('addVariant validates and rejects non-admins', async () => {
    asManager()
    expect(await actions.addVariant('m1', 'Half', 50)).toEqual({ error: 'Forbidden: Admin or Owner access required' })
    asOwner()
    expect((await actions.addVariant('m1', '', 50)).error).toBeDefined()
    expect((await actions.addVariant('m1', 'Half', -1)).error).toBeDefined()
  })

  it('addVariant rejects a duplicate name for the same item', async () => {
    runTx([{ id: 'v1', menuItemId: 'm1', name: 'half', isActive: true }])
    expect(await actions.addVariant('m1', 'Half', 50)).toEqual({ error: 'This item already has a variant with that name' })
  })

  it('addVariant appends with an incrementing sortOrder', async () => {
    const cap = runTx([{ id: 'v1', menuItemId: 'm1', name: 'Half', isActive: true, sortOrder: 0 }])
    const res = await actions.addVariant('m1', 'Full', 90)
    expect(res).toEqual({ success: true })
    expect(cap.list[1]).toMatchObject({ menuItemId: 'm1', name: 'Full', basePrice: 90, sortOrder: 1, isActive: true })
  })

  it('updateVariant validates input and handles not found', async () => {
    expect((await actions.updateVariant('', 'x', 10)).error).toBeDefined()
    expect((await actions.updateVariant('v1', '', 10)).error).toBeDefined()
    expect((await actions.updateVariant('v1', 'x', -5)).error).toBeDefined()
    runTx([])
    expect(await actions.updateVariant('v1', 'Half', 50)).toEqual({ error: 'Variant not found' })
  })

  it('updateVariant renames, reprices and records history', async () => {
    const cap = runTx([{ id: 'v1', menuItemId: 'm1', name: 'Half', basePrice: 50, isActive: true }])
    const res = await actions.updateVariant('v1', 'Half Plate', 55)
    expect(res).toEqual({ success: true })
    expect(cap.list[0]).toMatchObject({ name: 'Half Plate', basePrice: 55 })
    expect(vi.mocked(db.withTransaction).mock.calls.length).toBeGreaterThan(1) // history written
  })

  it('deleteVariant soft-deletes and handles not found', async () => {
    const cap = runTx([{ id: 'v1', menuItemId: 'm1', name: 'Half', isActive: true }])
    expect(await actions.deleteVariant('v1')).toEqual({ success: true })
    expect(cap.list[0].isActive).toBe(false)
    runTx([])
    expect(await actions.deleteVariant('nope')).toEqual({ error: 'Variant not found' })
  })
})

describe('menu.ts — branch availability & price', () => {
  it('setBranchItemAvailability requires a session', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(null as any)
    expect(await actions.setBranchItemAvailability('b1', 'm1', true)).toEqual({ error: 'Unauthorized' })
  })

  it('setBranchItemAvailability surfaces a branch-access error', async () => {
    vi.mocked(auth.requireBranchAccess).mockRejectedValue(new Error('Forbidden: You can only access your assigned branch.'))
    const res = await actions.setBranchItemAvailability('b2', 'm1', true)
    expect(res).toEqual({ error: 'Forbidden: You can only access your assigned branch.' })
  })

  it('setBranchItemAvailability updates an existing row and returns success', async () => {
    const cap = runBranchTx([{ id: 'r1', branchId: 'b1', menuItemId: 'm1', price: null, isAvailable: true }])
    const res = await actions.setBranchItemAvailability('b1', 'm1', false)
    expect(res).toEqual({ success: true })
    expect(cap.list[0].isAvailable).toBe(false)
    expect(cap.branchId).toBe('b1')   // wrote to the branch shard
  })

  it('setBranchItemAvailability creates a row when missing', async () => {
    const cap = runBranchTx([])
    await actions.setBranchItemAvailability('b1', 'm9', false)
    expect(cap.list[0]).toMatchObject({ branchId: 'b1', menuItemId: 'm9', price: null, isAvailable: false })
  })

  it('setBranchItemAvailability reports a failed write', async () => {
    vi.mocked(db.withBranchMenuTransaction).mockResolvedValue(false)
    expect(await actions.setBranchItemAvailability('b1', 'm1', true)).toEqual({ error: 'Failed to update availability' })
  })

  it('updateBranchMenuItemPrice validates the price', async () => {
    expect((await actions.updateBranchMenuItemPrice('b1', 'm1', 10.5)).error).toBeDefined()
    expect((await actions.updateBranchMenuItemPrice('b1', 'm1', -5)).error).toBeDefined()
  })

  it('updateBranchMenuItemPrice accepts null to inherit the base price', async () => {
    const cap = runBranchTx([{ id: 'r1', branchId: 'b1', menuItemId: 'm1', price: 90, isAvailable: true }])
    const res = await actions.updateBranchMenuItemPrice('b1', 'm1', null)
    expect(res).toEqual({ success: true })
    expect(cap.list[0].price).toBeNull()
  })

  it('updateBranchMenuItemPrice lets a manager change their own branch price', async () => {
    asManager('b1')
    const cap = runBranchTx([{ id: 'r1', branchId: 'b1', menuItemId: 'm1', price: null, isAvailable: true }])
    const res = await actions.updateBranchMenuItemPrice('b1', 'm1', 85)
    expect(res).toEqual({ success: true })
    expect(cap.list[0].price).toBe(85)
    expect(audit.logAction).toHaveBeenCalledWith(
      'UPDATE_BRANCH_PRICE', 'BRANCH_MENU_ITEM', expect.any(String), 'm1'
    )
  })

  it('updateBranchMenuItemPrice blocks a manager targeting another branch', async () => {
    asManager('b1')
    vi.mocked(auth.requireBranchAccess).mockRejectedValue(new Error('Forbidden: You can only access your assigned branch.'))
    const res = await actions.updateBranchMenuItemPrice('b2', 'm1', 85)
    expect(res.error).toMatch(/Forbidden/)
  })
})

describe('menu.ts — bulk operations', () => {
  it('bulkSetBranchAvailability validates input', async () => {
    expect(await actions.bulkSetBranchAvailability('b1', [], true)).toEqual({ error: 'No items selected' })
    vi.mocked(auth.getSession).mockResolvedValue(null as any)
    expect(await actions.bulkSetBranchAvailability('b1', ['m1'], true)).toEqual({ error: 'Unauthorized' })
  })

  it('bulkSetBranchAvailability updates existing and creates missing rows', async () => {
    const cap = runBranchTx([{ id: 'r1', branchId: 'b1', menuItemId: 'm1', price: null, isAvailable: true }])
    const res = await actions.bulkSetBranchAvailability('b1', ['m1', 'm2'], false)
    expect(res).toMatchObject({ success: true, changed: 2 })
    expect(cap.list).toHaveLength(2)
    expect(cap.list[0].isAvailable).toBe(false)
    expect(cap.list[1]).toMatchObject({ menuItemId: 'm2', isAvailable: false })
  })

  it('bulkUpdateBranchPrices validates mode and value', async () => {
    expect(await actions.bulkUpdateBranchPrices('b1', [], 'percent', 10)).toEqual({ error: 'No items selected' })
    expect(await actions.bulkUpdateBranchPrices('b1', ['m1'], 'bogus' as any, 10)).toEqual({ error: 'Invalid price change mode' })
    expect(await actions.bulkUpdateBranchPrices('b1', ['m1'], 'set', -1)).toEqual({ error: 'Price cannot be negative' })
    expect(await actions.bulkUpdateBranchPrices('b1', ['m1'], 'percent', NaN)).toEqual({ error: 'Invalid value' })
  })

  it('bulkUpdateBranchPrices applies a percentage off the effective base', async () => {
    vi.mocked(db.readJSON).mockResolvedValue([{ id: 'm1', basePrice: 100 }, { id: 'm2', basePrice: 50 }] as any)
    const cap = runBranchTx([{ id: 'r1', branchId: 'b1', menuItemId: 'm1', price: null, isAvailable: true }])
    const res = await actions.bulkUpdateBranchPrices('b1', ['m1', 'm2'], 'percent', 10)
    expect(res).toMatchObject({ success: true, changed: 2 })
    expect(cap.list.find((r: any) => r.menuItemId === 'm1').price).toBe(110)
    expect(cap.list.find((r: any) => r.menuItemId === 'm2').price).toBe(55)
  })

  it('bulkUpdateBranchPrices supports flat and set, flooring at 0', async () => {
    vi.mocked(db.readJSON).mockResolvedValue([{ id: 'm1', basePrice: 100 }] as any)
    let cap = runBranchTx([])
    await actions.bulkUpdateBranchPrices('b1', ['m1'], 'flat', -250)
    expect(cap.list[0].price).toBe(0)

    cap = runBranchTx([])
    await actions.bulkUpdateBranchPrices('b1', ['m1'], 'set', 199)
    expect(cap.list[0].price).toBe(199)
  })

  it('bulkUpdateBranchPrices ignores ids that are not in the catalog', async () => {
    vi.mocked(db.readJSON).mockResolvedValue([{ id: 'm1', basePrice: 100 }] as any)
    const cap = runBranchTx([])
    const res = await actions.bulkUpdateBranchPrices('b1', ['m1', 'ghost'], 'set', 10)
    expect(res).toMatchObject({ changed: 1 })
    expect(cap.list).toHaveLength(1)
  })
})

describe('menu.ts — cloneBranchMenuConfig', () => {
  it('validates the branch pair and options', async () => {
    expect(await actions.cloneBranchMenuConfig('', 'b2')).toEqual({ error: 'Both source and target branches are required' })
    expect(await actions.cloneBranchMenuConfig('b1', 'b1')).toEqual({ error: 'Source and target branches must differ' })
    expect(await actions.cloneBranchMenuConfig('b1', 'b2', { prices: false, availability: false }))
      .toEqual({ error: 'Select at least prices or availability to copy' })
  })

  it('requires a session', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(null as any)
    expect(await actions.cloneBranchMenuConfig('b1', 'b2')).toEqual({ error: 'Unauthorized' })
  })

  it('errors when the source branch has no configuration', async () => {
    vi.mocked(db.readBranchMenuItems).mockResolvedValue([])
    expect(await actions.cloneBranchMenuConfig('b1', 'b2'))
      .toEqual({ error: 'Source branch has no menu configuration to copy' })
  })

  it('copies prices and availability into the target shard', async () => {
    vi.mocked(db.readBranchMenuItems).mockResolvedValue([
      { id: 's1', branchId: 'b1', menuItemId: 'm1', price: 90, isAvailable: false },
      { id: 's2', branchId: 'b1', menuItemId: 'm2', price: null, isAvailable: true },
    ] as any)
    const cap = runBranchTx([{ id: 't1', branchId: 'b2', menuItemId: 'm1', price: 100, isAvailable: true }])
    const res = await actions.cloneBranchMenuConfig('b1', 'b2')
    expect(res).toMatchObject({ success: true, applied: 2 })
    expect(cap.branchId).toBe('b2')
    expect(cap.list.find((r: any) => r.menuItemId === 'm1')).toMatchObject({ price: 90, isAvailable: false })
    expect(cap.list.find((r: any) => r.menuItemId === 'm2')).toMatchObject({ price: null, isAvailable: true })
  })

  it('copies only availability when prices are excluded', async () => {
    vi.mocked(db.readBranchMenuItems).mockResolvedValue([
      { id: 's1', branchId: 'b1', menuItemId: 'm1', price: 90, isAvailable: false },
    ] as any)
    const cap = runBranchTx([{ id: 't1', branchId: 'b2', menuItemId: 'm1', price: 100, isAvailable: true }])
    await actions.cloneBranchMenuConfig('b1', 'b2', { prices: false, availability: true })
    expect(cap.list[0]).toMatchObject({ price: 100, isAvailable: false })
  })

  it('reports a failed write', async () => {
    vi.mocked(db.readBranchMenuItems).mockResolvedValue([
      { id: 's1', branchId: 'b1', menuItemId: 'm1', price: 90, isAvailable: true },
    ] as any)
    vi.mocked(db.withBranchMenuTransaction).mockResolvedValue(false)
    expect(await actions.cloneBranchMenuConfig('b1', 'b2')).toEqual({ error: 'Clone failed' })
  })
})
