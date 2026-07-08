import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  addDepartment, updateDepartment, deleteDepartment,
  addRole, updateRole, deleteRole
} from '@/app/actions/settings'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn(),
  writeJSON: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Settings Actions', () => {
  beforeEach(() => { vi.resetAllMocks() 
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'owner', isGlobalOwner: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b1')
    vi.spyOn(auth, 'getSessionRole').mockResolvedValue('owner')
  })

  // ─── addDepartment ────────────────────────────────────────────────────────
  it('addDepartment validates name', async () => {
    const res = await addDepartment({}, { get: () => null, getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Name is required' })
  })

  it('addDepartment succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await addDepartment({}, { get: () => 'Kitchen', getAll: () => [] } as any)
    expect(res).toEqual({ success: true })
  })

  it('addDepartment handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const res = await addDepartment({}, { get: () => 'Kitchen', getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Failed to add department' })
  })

  // ─── updateDepartment ────────────────────────────────────────────────────
  it('updateDepartment validates id/name', async () => {
    const res = await updateDepartment({}, { get: () => null, getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Invalid data' })
  })

  it('updateDepartment handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await updateDepartment({}, { get: () => 'test', getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Not found' })
  })

  it('updateDepartment succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'test', name: 'Old' }])
      return true
    })
    const res = await updateDepartment({}, { get: () => 'test', getAll: () => [] } as any)
    expect(res).toEqual({ success: true })
  })

  // ─── deleteDepartment ────────────────────────────────────────────────────
  it('deleteDepartment succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([{ id: 'd1' }]); return true })
    const res = await deleteDepartment('d1')
    expect(res).toEqual({ success: true })
  })

  it('deleteDepartment handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const res = await deleteDepartment('d1')
    expect(res).toEqual({ error: 'Failed to delete department' })
  })

  // ─── addRole ──────────────────────────────────────────────────────────────
  it('addRole validates name', async () => {
    const res = await addRole({}, { get: () => null, getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Name is required' })
  })

  it('addRole succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await addRole({}, { get: (k: string) => 'RoleName', getAll: () => ['d1'] } as any)
    expect(res).toEqual({ success: true })
  })

  it('addRole handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const res = await addRole({}, { get: () => 'RoleName', getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Failed to add role' })
  })

  // ─── updateRole ──────────────────────────────────────────────────────────
  it('updateRole validates id/name', async () => {
    const res = await updateRole({}, { get: () => null, getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Invalid data' })
  })

  it('updateRole handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await updateRole({}, { get: () => 'test', getAll: () => ['d1'] } as any)
    expect(res).toEqual({ error: 'Not found' })
  })

  it('updateRole succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'test', name: 'Old' }])
      return true
    })
    const res = await updateRole({}, { get: () => 'test', getAll: () => ['d1'] } as any)
    expect(res).toEqual({ success: true })
  })

  // ─── deleteRole ──────────────────────────────────────────────────────────
  it('deleteRole succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([{ id: 'r1' }]); return true })
    const res = await deleteRole('r1')
    expect(res).toEqual({ success: true })
  })

  it('deleteRole handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const res = await deleteRole('r1')
    expect(res).toEqual({ error: 'Failed to delete role' })
  })
})
