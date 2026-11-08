import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as actions from '@/app/actions/menu_categories'
import * as auth from '@/app/actions/auth'
import * as audit from '@/lib/audit'

const { mockDb, mockWithDbTransaction } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state: any = {
    categories: [] as any[],
    branchCategories: [] as any[],
    failNext: false,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    state,
    get categories() { return state.categories },
    get branchCategories() { return state.branchCategories },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: vi.fn((_fields?: any) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      from: vi.fn((table: any) => {
        let collection = table?.tableName === 'branch_categories' ? state.branchCategories : state.categories

        let filtered = collection
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const builder: any = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          where: vi.fn((cond?: any) => {
            if (state.failNext) throw new Error('Database error')
            if (cond) {
              const str = JSON.stringify(cond)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              filtered = collection.filter((item: any) => {
                if (table?.tableName === 'branch_categories') {
                  const bMatch = !item.branchId || str.includes(`"${item.branchId}"`)
                  const cMatch = !item.categoryId || str.includes(`"${item.categoryId}"`)
                  return bMatch && cMatch
                }
                // menuCategories
                if (str.includes('<>') && str.includes(`"${item.id}"`)) {
                  return false
                }
                if (str.includes('"nope"') || str.includes('"zz"')) {
                  return false
                }
                if (!str.includes('<>')) {
                  if (str.includes('"c1"') && item.id !== 'c1') return false
                  if (str.includes('"c2"') && item.id !== 'c2') return false
                  if (str.includes('"c3"') && item.id !== 'c3') return false
                }
                if (str.toLowerCase().includes('"starters"') && item.name?.toLowerCase() !== 'starters') return false
                if (str.toLowerCase().includes('"b"') && item.name?.toLowerCase() !== 'b') return false
                return true
              })
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
        const row = { ...vals }
        if (table?.tableName === 'branch_categories') {
          state.branchCategories.push(row)
        } else {
          state.categories.push(row)
        }
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
          const str = JSON.stringify(cond)
          const collection = table?.tableName === 'branch_categories' ? state.branchCategories : state.categories
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
  const mockTx = vi.fn(async (cb: any) => {
    if (state.failNext) throw new Error('Transaction failed')
    return cb(mock)
  })

  return { mockDb: mock, mockWithDbTransaction: mockTx }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  withDbTransaction: mockWithDbTransaction,
  menuCategories: {
    tableName: 'menu_categories',
    id: { name: 'id' },
    name: { name: 'name' },
    sortOrder: { name: 'sort_order' },
    isActive: { name: 'is_active' },
    deletedAt: { name: 'deleted_at' },
  },
  branchCategories: {
    tableName: 'branch_categories',
    id: { name: 'id' },
    branchId: { name: 'branch_id' },
    categoryId: { name: 'category_id' },
    isAvailable: { name: 'is_available' },
  },
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asOwner = () => vi.mocked(auth.getSession).mockResolvedValue({ userId: 'u1', name: 'Owner', isGlobalAdmin: true } as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asManager = (branchId = 'b1') => vi.mocked(auth.getSession).mockResolvedValue({ userId: 'u2', name: 'Mgr', isGlobalAdmin: false, branchId } as any)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seedCategories = (items: any[]) => {
  mockDb.state.categories = items.map(it => ({ ...it }))
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seedBranchCategories = (items: any[]) => {
  mockDb.state.branchCategories = items.map(it => ({ ...it }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.state.categories = []
  mockDb.state.branchCategories = []
  mockDb.state.failNext = false
  asOwner()
  vi.mocked(auth.requireBranchAccess).mockImplementation(async (b?: string) => b || 'b1')
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
    seedCategories([{ id: 'c1', name: 'starters', isActive: true, deletedAt: null }])
    expect(await actions.addMenuCategory({}, fd({ name: 'Starters' })))
      .toEqual({ error: 'Category name already exists' })
  })

  it('creates the category and audits', async () => {
    seedCategories([])
    const res = await actions.addMenuCategory({}, fd({ name: 'Starters' }))
    expect(res).toEqual({ success: true })
    expect(mockDb.state.categories[0]).toMatchObject({ name: 'Starters', isActive: true })
    expect(audit.logAction).toHaveBeenCalledWith('CREATE_MENU_CATEGORY', 'MENU_CATEGORY', expect.any(String), expect.any(String))
  })

  it('reports a failed transaction', async () => {
    mockDb.state.failNext = true
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
    seedCategories([{ id: 'c1', name: 'A', isActive: true, deletedAt: null }])
    expect(await actions.updateMenuCategory({}, fd({ id: 'zz', name: 'B' }))).toEqual({ error: 'Category not found' })
    seedCategories([
      { id: 'c1', name: 'A', isActive: true, deletedAt: null },
      { id: 'c2', name: 'B', isActive: true, deletedAt: null },
    ])
    expect(await actions.updateMenuCategory({}, fd({ id: 'c1', name: 'B' }))).toEqual({ error: 'Category name already exists' })
  })

  it('renames and optionally sets sortOrder', async () => {
    seedCategories([{ id: 'c1', name: 'A', isActive: true, deletedAt: null }])
    const res = await actions.updateMenuCategory({}, fd({ id: 'c1', name: 'Mains', sortOrder: '3' }))
    expect(res).toEqual({ success: true })
    expect(mockDb.state.categories[0]).toMatchObject({ name: 'Mains', sortOrder: 3 })
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
    seedCategories([
      { id: 'c1', name: 'A', sortOrder: 50 },
      { id: 'c2', name: 'B', sortOrder: 10 },
      { id: 'c3', name: 'C', sortOrder: 20 },
    ])
    const res = await actions.reorderMenuCategories(['c3', 'c1', 'c2'])
    expect(res).toEqual({ success: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(mockDb.state.categories.find((c: any) => c.id === 'c3').sortOrder).toBe(0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(mockDb.state.categories.find((c: any) => c.id === 'c1').sortOrder).toBe(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(mockDb.state.categories.find((c: any) => c.id === 'c2').sortOrder).toBe(2)
    expect(mockWithDbTransaction).toHaveBeenCalledTimes(1)
    expect(audit.logAction).toHaveBeenCalledWith('REORDER_MENU_CATEGORIES', 'MENU_CATEGORY', expect.any(String))
  })

  it('reports a failed transaction', async () => {
    mockDb.state.failNext = true
    expect(await actions.reorderMenuCategories(['c1'])).toEqual({ error: 'Transaction failed' })
  })
})

describe('menu_categories — deleteMenuCategory', () => {
  it('blocks non-global-admins', async () => {
    asManager()
    expect(await actions.deleteMenuCategory('c1')).toEqual({ error: 'Forbidden: Admin or Owner access required' })
  })

  it('soft-deletes and audits', async () => {
    seedCategories([{ id: 'c1', name: 'A', isActive: true, deletedAt: null }])
    expect(await actions.deleteMenuCategory('c1')).toEqual({ success: true })
    expect(mockDb.state.categories[0].isActive).toBe(false)
    expect(audit.logAction).toHaveBeenCalledWith('DELETE_MENU_CATEGORY', 'MENU_CATEGORY', expect.any(String), 'c1')
  })

  it('handles not found', async () => {
    seedCategories([])
    expect(await actions.deleteMenuCategory('nope')).toEqual({ error: 'Category not found' })
  })
})

describe('menu_categories — setBranchCategoryAvailability', () => {
  it('requires a session', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    seedBranchCategories([{ id: 'bc1', branchId: 'b1', categoryId: 'c1', isAvailable: true }])
    const res = await actions.setBranchCategoryAvailability('b1', 'c1', false)
    expect(res).toEqual({ success: true })
    expect(mockDb.state.branchCategories[0].isAvailable).toBe(false)
    expect(audit.logAction).toHaveBeenCalledWith(
      'SET_CATEGORY_AVAILABILITY', 'BRANCH_MENU_CATEGORY', expect.any(String), 'c1'
    )
  })

  it('creates a mapping when none exists', async () => {
    seedBranchCategories([])
    await actions.setBranchCategoryAvailability('b1', 'c9', false)
    expect(mockDb.state.branchCategories[0]).toMatchObject({ branchId: 'b1', categoryId: 'c9', isAvailable: false })
  })

  it('reports a failed write', async () => {
    mockDb.state.failNext = true
    expect(await actions.setBranchCategoryAvailability('b1', 'c1', true))
      .toEqual({ error: 'Failed to update category availability' })
  })
})
