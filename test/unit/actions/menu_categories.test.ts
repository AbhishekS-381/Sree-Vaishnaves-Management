import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addMenuCategory, updateMenuCategory, deleteMenuCategory } from '@/app/actions/menu_categories'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn().mockResolvedValue([]),
  writeJSON: vi.fn().mockResolvedValue(true),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Menu Categories Actions', () => {
  beforeEach(() => { vi.clearAllMocks() 
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b1')
    vi.spyOn(auth, 'getSessionRole').mockResolvedValue('owner')
  })

  it('addMenuCategory validates name+branch', async () => {
    const res = await addMenuCategory({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'Name is required' })
  })

  it('addMenuCategory succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await addMenuCategory({}, { get: () => 'test' } as any)
    expect(res).toEqual({ success: true })
  })

  it('addMenuCategory rejects duplicate category', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'existing_id', name: 'ExistingName' }])
      return true
    })
    const res = await addMenuCategory({}, { get: () => 'ExistingName' } as any)
    expect(res).toEqual({ error: 'Category name already exists' })
  })

  it('addMenuCategory handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const res = await addMenuCategory({}, { get: () => 'test' } as any)
    expect(res).toEqual({ error: 'Failed to add menu category' })
  })

  it('updateMenuCategory validates missing fields', async () => {
    const res = await updateMenuCategory({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'Invalid data' })
  })

  it('updateMenuCategory handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await updateMenuCategory({}, { get: () => 'test' } as any)
    expect(res).toEqual({ error: 'Category not found' })
  })

  it('updateMenuCategory succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'test', name: 'Old', branchId: 'b1' }])
      return true
    })
    const res = await updateMenuCategory({}, { get: () => 'test' } as any)
    expect(res).toEqual({ success: true })
  })

  it('updateMenuCategory rejects duplicate category', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([
        { id: 'test', name: 'Old' },
        { id: 'other', name: 'ExistingName' }
      ])
      return true
    })
    const res = await updateMenuCategory({}, { get: (k: string) => k === 'id' ? 'test' : 'ExistingName' } as any)
    expect(res).toEqual({ error: 'Category name already exists' })
  })

  it('deleteMenuCategory succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([{ id: 'mc1' }]); return true })
    const res = await deleteMenuCategory('mc1')
    expect(res).toEqual({ success: true })
  })

  it('deleteMenuCategory handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const res = await deleteMenuCategory('mc1')
    expect(res).toEqual({ error: 'Failed to delete menu category' })
  })
})
