import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addCategory, updateCategory, deleteCategory } from '@/app/actions/categories'
import * as auth from '@/app/actions/auth'

const { mockDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }
  return { mockDb: mock }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  categories: {
    id: 'id',
    name: 'name',
    color: 'color',
    isActive: 'isActive',
    deletedAt: 'deletedAt',
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Categories Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.limit.mockResolvedValue([])
    mockDb.insert.mockReturnThis()
    mockDb.values.mockResolvedValue([])
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true, branchId: 'b1' } as any)
  })

  // ─── addCategory ──────────────────────────────────────────────────────────
  it('addCategory validates role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ isGlobalAdmin: false } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addCategory({}, { get: () => 'name' } as any)
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('addCategory validates name', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addCategory({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'Name is required' })
  })

  it('addCategory rejects duplicate', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'cat_1' }])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addCategory({}, { get: (k: string) => k === 'name' ? 'food' : null } as any)
    expect(res).toEqual({ error: 'Category already exists' })
  })

  it('addCategory succeeds', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addCategory({}, { get: (k: string) => k === 'name' ? 'NewCat' : '#ff0000' } as any)
    expect(res).toEqual({ success: true })
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('addCategory applies default color when omitted', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    let insertedValue: any = null
    mockDb.values.mockImplementationOnce((val: any) => {
      insertedValue = val
      return Promise.resolve([])
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addCategory({}, { get: (k: string) => k === 'name' ? 'Gas' : null } as any)
    expect(res).toEqual({ success: true })
    expect(insertedValue?.color).toBe('#64748b')
  })

  it('addCategory handles db failure', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    mockDb.values.mockRejectedValueOnce(new Error('db down'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addCategory({}, { get: (k: string) => k === 'name' ? 'NewCat' : null } as any)
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── updateCategory ──────────────────────────────────────────────────────
  it('updateCategory validates role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ isGlobalAdmin: false } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateCategory({}, { get: () => 'name' } as any)
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('updateCategory validates id/name', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateCategory({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'Missing required fields' })
  })

  it('updateCategory handles not found', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // target not found
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateCategory({}, { get: (k: string) => k === 'id' ? 'c1' : 'test' } as any)
    expect(res).toEqual({ error: 'Category not found' })
  })

  it('updateCategory rejects duplicate name', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'c1' }]) // found target
      .mockResolvedValueOnce([{ id: 'c2' }]) // duplicate exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => k === 'id' ? 'c1' : k === 'name' ? 'existing' : null
    } as any
    const res = await updateCategory({}, fd)
    expect(res).toEqual({ error: 'Category name already exists' })
  })

  it('updateCategory succeeds', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'c1' }]) // found target
      .mockResolvedValueOnce([]) // no duplicate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => k === 'id' ? 'c1' : k === 'name' ? 'updatedName' : '#00ff00'
    } as any
    const res = await updateCategory({}, fd)
    expect(res).toEqual({ success: true })
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('updateCategory handles db failure', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'c1' }])
      .mockResolvedValueOnce([])
    mockDb.set.mockReturnValueOnce({
      where: vi.fn().mockRejectedValueOnce(new Error('db down'))
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => k === 'id' ? 'c1' : k === 'name' ? 'updated' : null
    } as any
    const res = await updateCategory({}, fd)
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── deleteCategory ──────────────────────────────────────────────────────
  it('deleteCategory validates role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ isGlobalAdmin: false } as any)
    const res = await deleteCategory('1')
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('deleteCategory handles not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await deleteCategory('1')
    expect(res).toEqual({ error: 'Category not found' })
  })

  it('deleteCategory succeeds with soft delete', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: '1' }])
    const res = await deleteCategory('1')
    expect(res).toEqual({ success: true })
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('deleteCategory handles db failure', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: '1' }])
    mockDb.set.mockReturnValueOnce({
      where: vi.fn().mockRejectedValueOnce(new Error('db down'))
    })
    const res = await deleteCategory('1')
    expect(res).toEqual({ error: 'Transaction failed' })
  })
})
