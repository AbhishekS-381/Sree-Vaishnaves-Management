import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as actions from '@/app/actions/menu_categories'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'
import * as audit from '@/lib/audit'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn().mockResolvedValue([]),
  DB_FILES: new Proxy({}, { get: (_t, p) => String(p).toLowerCase() + '.json' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAction: vi.fn() }))
vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn(),
  requireBranchAccess: vi.fn(),
}))

const fd = (values: Record<string, string>) => ({
  get: (k: string) => (values[k] === undefined ? null : values[k]),
  getAll: (k: string) => (values[k] === undefined ? [] : [values[k]]),
}) as unknown as FormData

const asOwner = () => vi.mocked(auth.getSession).mockResolvedValue({ userId: 'u1', name: 'Owner', isGlobalAdmin: true } as any)
const asManager = (branchId = 'b1') => vi.mocked(auth.getSession).mockResolvedValue({ userId: 'u2', name: 'Mgr', isGlobalAdmin: false, branchId } as any)

const runTx = (seed: any[] = [], ok = true) => {
  const captured: { list: any[] } = { list: [] }
  vi.mocked(db.withTransaction).mockImplementation(async (_f: string, cb: any) => {
    captured.list = await cb([...seed])
    return ok
  })
  return captured
}

beforeEach(() => {
  vi.clearAllMocks()
  asOwner()
  vi.mocked(auth.requireBranchAccess).mockImplementation(async (b?: string) => b || 'b1')
  vi.mocked(db.withTransaction).mockResolvedValue(true)
})

describe('menu_categories — addMenuCategory', () => {
  it('blocks non-global-admins', async () => {
    asManager()
    expect(await actions.addMenuCategory({}, fd({ name: 'Starters' })))
      .toEqual({ error: 'Forbidden: Admin or Owner access required' })
  })

  it('requires a name and enforces max length', async () => {
    expect(await actions.addMenuCategory({}, fd({}))).toEqual({ error: 'Name is required' })
    expect(await actions.addMenuCategory({}, fd({ name: 'x'.repeat(101) }))).toEqual({ error: 'Name too long' })
  })

  it('rejects a duplicate active name', async () => {
    runTx([{ id: 'c1', name: 'starters', isActive: true }])
    expect(await actions.addMenuCategory({}, fd({ name: 'Starters' })))
      .toEqual({ error: 'Category name already exists' })
  })

  it('creates the category and audits', async () => {
    const cap = runTx([])
    const res = await actions.addMenuCategory({}, fd({ name: 'Starters' }))
    expect(res).toEqual({ success: true })
    expect(cap.list[0]).toMatchObject({ name: 'Starters', isActive: true })
    expect(audit.logAction).toHaveBeenCalledWith('CREATE_MENU_CATEGORY', 'MENU_CATEGORY', expect.any(String), expect.any(String))
  })

  it('reports a failed transaction', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    expect(await actions.addMenuCategory({}, fd({ name: 'Starters' })))
      .toEqual({ error: 'Failed to add menu category' })
  })
})

describe('menu_categories — updateMenuCategory', () => {
  it('blocks non-global-admins and validates input', async () => {
    asManager()
    expect(await actions.updateMenuCategory({}, fd({ id: 'c1', name: 'A' })))
      .toEqual({ error: 'Forbidden: Admin or Owner access required' })
    asOwner()
    expect(await actions.updateMenuCategory({}, fd({ name: 'A' }))).toEqual({ error: 'Invalid data' })
    expect(await actions.updateMenuCategory({}, fd({ id: 'c1', name: 'x'.repeat(101) }))).toEqual({ error: 'Name too long' })
  })

  it('handles not found and duplicates', async () => {
    runTx([{ id: 'c1', name: 'A', isActive: true }])
    expect(await actions.updateMenuCategory({}, fd({ id: 'zz', name: 'B' }))).toEqual({ error: 'Category not found' })
    runTx([{ id: 'c1', name: 'A', isActive: true }, { id: 'c2', name: 'B', isActive: true }])
    expect(await actions.updateMenuCategory({}, fd({ id: 'c1', name: 'B' }))).toEqual({ error: 'Category name already exists' })
  })

  it('renames and optionally sets sortOrder', async () => {
    const cap = runTx([{ id: 'c1', name: 'A', isActive: true }])
    const res = await actions.updateMenuCategory({}, fd({ id: 'c1', name: 'Mains', sortOrder: '3' }))
    expect(res).toEqual({ success: true })
    expect(cap.list[0]).toMatchObject({ name: 'Mains', sortOrder: 3 })
    expect(audit.logAction).toHaveBeenCalledWith('UPDATE_MENU_CATEGORY', 'MENU_CATEGORY', expect.any(String), 'c1')
  })
})

describe('menu_categories — reorderMenuCategories (atomic)', () => {
  it('blocks non-global-admins and empty input', async () => {
    asManager()
    expect(await actions.reorderMenuCategories(['c1'])).toEqual({ error: 'Forbidden: Admin or Owner access required' })
    asOwner()
    expect(await actions.reorderMenuCategories([])).toEqual({ error: 'Nothing to reorder' })
  })

  it('assigns sortOrder by index in a single write', async () => {
    const cap = runTx([
      { id: 'c1', name: 'A', sortOrder: 50 },
      { id: 'c2', name: 'B', sortOrder: 10 },
      { id: 'c3', name: 'C', sortOrder: 20 },
    ])
    const res = await actions.reorderMenuCategories(['c3', 'c1', 'c2'])
    expect(res).toEqual({ success: true })
    expect(cap.list.find((c: any) => c.id === 'c3').sortOrder).toBe(0)
    expect(cap.list.find((c: any) => c.id === 'c1').sortOrder).toBe(1)
    expect(cap.list.find((c: any) => c.id === 'c2').sortOrder).toBe(2)
    expect(vi.mocked(db.withTransaction)).toHaveBeenCalledTimes(1)   // one atomic write, not two swaps
    expect(audit.logAction).toHaveBeenCalledWith('REORDER_MENU_CATEGORIES', 'MENU_CATEGORY', expect.any(String))
  })

  it('ignores unknown ids', async () => {
    const cap = runTx([{ id: 'c1', name: 'A', sortOrder: 9 }])
    await actions.reorderMenuCategories(['ghost', 'c1'])
    expect(cap.list[0].sortOrder).toBe(1)
  })

  it('reports a failed transaction', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    expect(await actions.reorderMenuCategories(['c1'])).toEqual({ error: 'Transaction failed' })
  })
})

describe('menu_categories — deleteMenuCategory', () => {
  it('blocks non-global-admins', async () => {
    asManager()
    expect(await actions.deleteMenuCategory('c1')).toEqual({ error: 'Forbidden: Admin or Owner access required' })
  })

  it('soft-deletes and audits', async () => {
    const cap = runTx([{ id: 'c1', name: 'A', isActive: true }])
    expect(await actions.deleteMenuCategory('c1')).toEqual({ success: true })
    expect(cap.list[0].isActive).toBe(false)
    expect(audit.logAction).toHaveBeenCalledWith('DELETE_MENU_CATEGORY', 'MENU_CATEGORY', expect.any(String), 'c1')
  })

  it('handles not found', async () => {
    runTx([])
    expect(await actions.deleteMenuCategory('nope')).toEqual({ error: 'Category not found' })
  })
})

describe('menu_categories — setBranchCategoryAvailability', () => {
  it('requires a session', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(null as any)
    expect(await actions.setBranchCategoryAvailability('b1', 'c1', true)).toEqual({ error: 'Unauthorized' })
  })

  it('surfaces a branch-access error instead of failing silently', async () => {
    asManager('b1')
    vi.mocked(auth.requireBranchAccess).mockRejectedValue(new Error('Forbidden: You can only access your assigned branch.'))
    const res = await actions.setBranchCategoryAvailability('b2', 'c1', false)
    expect(res).toEqual({ error: 'Forbidden: You can only access your assigned branch.' })
  })

  it('lets a manager toggle their own branch and returns success', async () => {
    asManager('b1')
    const cap = runTx([{ id: 'bc1', branchId: 'b1', categoryId: 'c1', isAvailable: true }])
    const res = await actions.setBranchCategoryAvailability('b1', 'c1', false)
    expect(res).toEqual({ success: true })
    expect(cap.list[0].isAvailable).toBe(false)
    expect(audit.logAction).toHaveBeenCalledWith(
      'SET_CATEGORY_AVAILABILITY', 'BRANCH_MENU_CATEGORY', expect.any(String), 'c1'
    )
  })

  it('creates a mapping when none exists', async () => {
    const cap = runTx([])
    await actions.setBranchCategoryAvailability('b1', 'c9', false)
    expect(cap.list[0]).toMatchObject({ branchId: 'b1', categoryId: 'c9', isAvailable: false })
  })

  it('reports a failed write', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    expect(await actions.setBranchCategoryAvailability('b1', 'c1', true))
      .toEqual({ error: 'Failed to update category availability' })
  })
})
