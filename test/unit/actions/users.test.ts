import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addUser, updateUser, deleteUser } from '@/app/actions/users'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Users Actions', () => {
  beforeEach(() => { vi.clearAllMocks() 
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b1')
    vi.spyOn(auth, 'getSessionRole').mockResolvedValue('owner')
  })

  // ─── addUser ──────────────────────────────────────────────────────────────
  it('addUser validates required fields', async () => {
    const res = await addUser({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'All fields required' })
  })

  it('addUser rejects duplicate name', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'u1', name: 'alice', role: 'owner' }])
      return true
    })
    const fd = { get: (k: string) => k === 'name' ? 'Alice' : 'test' } as any
    const res = await addUser({}, fd)
    expect(res).toEqual({ error: 'Username already exists' })
  })

  it('addUser succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const fd = { get: (k: string) => k === 'name' ? 'newuser' : 'test' } as any
    const res = await addUser({}, fd)
    expect(res).toEqual({ success: true })
  })

  it('addUser handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return false })
    const fd = { get: (k: string) => k === 'name' ? 'newuser' : 'test' } as any
    const res = await addUser({}, fd)
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── updateUser ──────────────────────────────────────────────────────────
  it('updateUser validates required fields', async () => {
    const res = await updateUser({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'Invalid data' })
  })

  it('updateUser handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const fd = { get: () => 'test' } as any
    const res = await updateUser({}, fd)
    expect(res).toEqual({ error: 'Not found' })
  })

  it('updateUser rejects duplicate name for another user', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([
        { id: 'u1', name: 'alice', role: 'owner' },
        { id: 'u2', name: 'test', role: 'Staff' }
      ])
      return true
    })
    // Looking for id='u1', setting name='test' (which conflicts with u2)
    const fd = { get: (k: string) => k === 'id' ? 'u1' : 'test' } as any
    const res = await updateUser({}, fd)
    expect(res).toEqual({ error: 'Username taken by another user' })
  })

  it('updateUser succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'test', name: 'uniqueuser', role: 'Staff', password: 'oldpw' }])
      return true
    })
    const fd = { get: (k: string) => k === 'id' ? 'test' : k === 'name' ? 'uniqueuser' : 'test' } as any
    const res = await updateUser({}, fd)
    expect(res).toEqual({ success: true })
  })

  // ─── deleteUser ──────────────────────────────────────────────────────────
  it('deleteUser succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'u1' }])
      return true
    })
    const res = await deleteUser('u1')
    expect(res).toEqual({ success: true })
  })
})
