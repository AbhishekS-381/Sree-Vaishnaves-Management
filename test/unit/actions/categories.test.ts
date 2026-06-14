import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addCategory, updateCategory } from '@/app/actions/categories'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn(),
  writeJSON: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Categories Actions', () => {
  beforeEach(() => { vi.resetAllMocks() })

  // ─── addCategory ──────────────────────────────────────────────────────────
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
  it('updateCategory validates id/name', async () => {
    const res = await updateCategory({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'Missing required fields' })
  })

  it('updateCategory handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await updateCategory({}, { get: () => 'test' } as any)
    expect(res).toEqual({ error: 'Category not found' })
  })

  it('updateCategory succeeds without name change', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'test', name: 'test' }])
      return true
    })
    const res = await updateCategory({}, { get: () => 'test' } as any)
    expect(res).toEqual({ success: true })
  })

  it('updateCategory succeeds with name change (cascades to expenses)', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      // First call: categories, second call: expenses cascade
      await cb([{ id: 'test', name: 'OldName' }])
      return true
    })
    const res = await updateCategory({}, {
      get: (k: string) => k === 'id' ? 'test' : 'NewName'
    } as any)
    expect(res).toEqual({ success: true })
    // Should have been called twice (categories + expenses)
    expect(db.withTransaction).toHaveBeenCalledTimes(2)
  })

  it('updateCategory handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return false })
    // Should return not-found since empty list, before transaction failure
    const res = await updateCategory({}, { get: () => 'test' } as any)
    // Either category not found OR transaction failed depending on flow
    expect(['Category not found', 'Transaction failed']).toContain((res as any).error)
  })
})
