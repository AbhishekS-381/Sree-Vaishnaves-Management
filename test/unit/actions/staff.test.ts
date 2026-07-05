import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addStaff, updateStaff, toggleStaffStatus, deleteStaff } from '@/app/actions/staff'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import * as auth from '@/app/actions/auth'

const mockFd = (overrides: Record<string, string> = {}) => ({
  get: (k: string) => overrides[k] ?? 'test_value'
} as any as FormData)

describe('Staff Actions', () => {
  beforeEach(() => { 
    vi.resetAllMocks() 
    vi.spyOn(auth, 'getSession').mockResolvedValue({ userId: 'test-user', role: 'owner', isGlobalAdmin: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockImplementation(async (b) => (b as string) || 'b1')
  })

  // ─── addStaff ──────────────────────────────────────────────────────────────
  it('addStaff validates missing fields', async () => {
    const res = await addStaff({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'All fields are required' })
  })

  it('addStaff succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await addStaff({}, mockFd())
    expect(res).toEqual({ success: true })
  })

  it('addStaff handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const res = await addStaff({}, mockFd())
    expect(res).toEqual({ error: 'Failed to save data' })
  })

  // ─── updateStaff ──────────────────────────────────────────────────────────
  it('updateStaff validates invalid id/name', async () => {
    const res = await updateStaff({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'Invalid ID or Name' })
  })

  it('updateStaff handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await updateStaff({}, mockFd({ status: 'active' }))
    expect(res).toEqual({ error: 'Staff not found' })
  })

  it('updateStaff succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'test_value', name: 'Old', isActive: false, branchId: 'b1' }])
      return true
    })
    const res = await updateStaff({}, mockFd({ status: 'active', branchId: 'b1' }))
    expect(res).toEqual({ success: true })
  })

  // ─── toggleStaffStatus ────────────────────────────────────────────────────
  it('toggleStaffStatus handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await toggleStaffStatus('s1', true)
    expect(res).toEqual({ error: 'Staff not found' })
  })

  it('toggleStaffStatus succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 's1', isActive: true }])
      return true
    })
    const res = await toggleStaffStatus('s1', true)
    expect(res).toEqual({ success: true })
  })

  // ─── deleteStaff ─────────────────────────────────────────────────────────
  it('deleteStaff handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await deleteStaff('s1')
    expect(res).toEqual({ error: 'Staff not found' })
  })

  it('deleteStaff succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 's1' }])
      return true
    })
    const res = await deleteStaff('s1')
    expect(res).toEqual({ success: true })
  })
})
