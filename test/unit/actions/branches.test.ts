import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addBranch, updateBranch, deleteBranch } from '@/app/actions/branches'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn().mockResolvedValue([]),
  writeJSON: vi.fn().mockResolvedValue(true),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Branches Actions', () => {
  beforeEach(() => { vi.clearAllMocks() 
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b1')
    vi.spyOn(auth, 'getSessionRole').mockResolvedValue('owner')
  })

  // ─── addBranch ────────────────────────────────────────────────────────────
  it('addBranch validates missing fields (name/address/phone)', async () => {
    const res = await addBranch({}, { get: () => '' } as any)
    // branches.ts returns the first zod issue or a custom error
    expect(res.error).toBeDefined()
  })

  it('addBranch succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const fd = { get: (k: string) => k === 'status' ? 'operational' : (k.includes('StartTime') ? '12:00' : k.includes('EndTime') ? '13:00' : 'test') } as any
    const res = await addBranch({}, fd)
    expect(res).toEqual({ success: true })
  })

  it('addBranch handles concurrent write failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const fd = { get: (k: string) => k === 'status' ? 'operational' : (k.includes('StartTime') ? '12:00' : k.includes('EndTime') ? '13:00' : 'test') } as any
    const res = await addBranch({}, fd)
    expect(res).toEqual({ error: 'Failed to add branch due to a concurrent write.' })
  })

  // ─── updateBranch ────────────────────────────────────────────────────────
  it('updateBranch validates missing id/name', async () => {
    const res = await updateBranch({}, { get: () => '' } as any)
    expect(res.error).toBeDefined()
  })

  it('updateBranch handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await updateBranch({}, { get: (k: string) => k.includes('StartTime') ? '12:00' : k.includes('EndTime') ? '13:00' : 'test' } as any)
    expect(res).toEqual({ error: 'Not found' })
  })

  it('updateBranch succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'test', name: 'Old' }])
      return true
    })
    const res = await updateBranch({}, { get: (k: string) => k.includes('StartTime') ? '12:00' : k.includes('EndTime') ? '13:00' : 'test' } as any)
    expect(res).toEqual({ success: true })
  })

  it('updateBranch handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'test', name: 'Old' }])
      return false
    })
    const res = await updateBranch({}, { get: (k: string) => k.includes('StartTime') ? '12:00' : k.includes('EndTime') ? '13:00' : 'test' } as any)
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
