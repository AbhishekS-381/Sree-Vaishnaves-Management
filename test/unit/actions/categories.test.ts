import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addCategory, updateCategory, deleteCategory } from '@/app/actions/categories'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn().mockResolvedValue([]),
  writeJSON: vi.fn().mockResolvedValue(true),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Categories Actions', () => {
  beforeEach(() => { vi.clearAllMocks() 
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true, branchId: 'b1' } as any)
  })

  // ─── addCategory ──────────────────────────────────────────────────────────
  it('addCategory validates role', async () => {
    vi.mocked(auth.getSession).mockResolvedValueOnce({ isGlobalAdmin: false } as any)
    const res = await addCategory({}, { get: () => 'name' } as any)
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('addCategory validates name', async () => {
    const res = await addCategory({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'Name is required' })
  })

  it('addCategory rejects duplicate', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'c1', name: 'Food' }])
      return true
    })
    const res = await addCategory({}, { get: (k: string) => k === 'name' ? 'food' : null } as any)
    expect(res).toEqual({ error: 'Category already exists' })
  })

  it('addCategory succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await addCategory({}, { get: (k: string) => k === 'name' ? 'NewCat' : '#ff0000' } as any)
    expect(res).toEqual({ success: true })
  })

  it('addCategory handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return false })
    const res = await addCategory({}, { get: (k: string) => k === 'name' ? 'NewCat' : null } as any)
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── updateCategory ──────────────────────────────────────────────────────
  it('updateCategory validates role', async () => {
    vi.mocked(auth.getSession).mockResolvedValueOnce({ isGlobalAdmin: false } as any)
    const res = await updateCategory({}, { get: () => 'name' } as any)
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('updateCategory validates id/name', async () => {
    const res = await updateCategory({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'Missing required fields' })
  })

  it('updateCategory handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await updateCategory({}, { get: () => 'test' } as any)
    expect(res).toEqual({ error: 'Category not found' })
  })

  it('updateCategory rejects duplicate name', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([
        { id: '1', name: 'test' },
        { id: '2', name: 'existing' }
      ])
      return true
    })
    const fd = {
      get: (k: string) => k === 'id' ? '1' : k === 'name' ? 'existing' : null
    } as any
    const res = await updateCategory({}, fd)
    expect(res).toEqual({ error: 'Category name already exists' })
  })

  it('updateCategory succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'test', name: 'test' }])
      return true
    })
    const res = await updateCategory({}, { get: () => 'test' } as any)
    expect(res).toEqual({ success: true })
  })

  it('updateCategory handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { 
      await cb([{ id: 'test', name: 'test' }])
      return false 
    })
    const res = await updateCategory({}, { get: () => 'test' } as any)
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── deleteCategory ──────────────────────────────────────────────────────
  it('deleteCategory validates role', async () => {
    vi.mocked(auth.getSession).mockResolvedValueOnce({ isGlobalAdmin: false } as any)
    const res = await deleteCategory('1')
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('deleteCategory handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await deleteCategory('1')
    expect(res).toEqual({ error: 'Category not found' })
  })

  it('deleteCategory handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: '1', name: 'test' }])
      return false
    })
    const res = await deleteCategory('1')
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  it('deleteCategory succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: '1', name: 'test' }])
      return true
    })
    const res = await deleteCategory('1')
    expect(res).toEqual({ success: true })
  })
})
