import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addBranch, updateBranch, deleteBranch } from '@/app/actions/branches'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Branches Actions', () => {
  beforeEach(() => { vi.resetAllMocks() })

  // ─── addBranch ────────────────────────────────────────────────────────────
  it('addBranch validates missing fields (name/address/phone)', async () => {
    const res = await addBranch({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'All fields are required' })
  })

  it('addBranch succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const fd = { get: (k: string) => k === 'status' ? 'operational' : 'test' } as any
    const res = await addBranch({}, fd)
    expect(res).toEqual({ success: true })
  })

  it('addBranch handles concurrent write failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const fd = { get: (k: string) => k === 'status' ? 'operational' : 'test' } as any
    const res = await addBranch({}, fd)
    expect(res).toEqual({ error: 'Failed to add branch due to a concurrent write.' })
  })

  // ─── updateBranch ────────────────────────────────────────────────────────
  it('updateBranch validates missing id/name', async () => {
    const res = await updateBranch({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'Invalid data' })
  })

  it('updateBranch handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await updateBranch({}, { get: () => 'test' } as any)
    expect(res).toEqual({ error: 'Not found' })
  })

  it('updateBranch succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'test', name: 'Old' }])
      return true
    })
    const res = await updateBranch({}, { get: () => 'test' } as any)
    expect(res).toEqual({ success: true })
  })

  it('updateBranch handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'test', name: 'Old' }])
      return false
    })
    const res = await updateBranch({}, { get: () => 'test' } as any)
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── deleteBranch ────────────────────────────────────────────────────────
  it('deleteBranch handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await deleteBranch('b1')
    expect(res).toEqual({ error: 'Branch not found' })
  })

  it('deleteBranch succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'b1' }])
      return true
    })
    const res = await deleteBranch('b1')
    expect(res).toEqual({ success: true })
  })

  it('deleteBranch handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'b1' }])
      return false
    })
    const res = await deleteBranch('b1')
    expect(res).toEqual({ error: 'Transaction failed' })
  })
})
