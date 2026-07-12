import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addStaff, updateStaff, toggleStaffStatus, deleteStaff } from '@/app/actions/staff'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn().mockResolvedValue([]),
  writeJSON: vi.fn().mockResolvedValue(true),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import * as auth from '@/app/actions/auth'

const mockFd = (overrides: Record<string, string> = {}) => ({
  get: (k: string) => overrides[k] ?? (k === 'branchId' ? 'b1' : 'test_value')
} as any as FormData)

describe('Staff Actions', () => {
  beforeEach(() => { 
    vi.clearAllMocks() 
    vi.spyOn(auth, 'getSession').mockResolvedValue({ userId: 'test-user', role: 'admin', isGlobalAdmin: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockImplementation(async (b) => (b as string) || 'b1')
  })

  // ─── addStaff ──────────────────────────────────────────────────────────────
  it('addStaff validates missing fields', async () => {
    const res = await addStaff({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'All fields are required' })
  })

  it('addStaff succeeds and generates UUID', async () => {
    let savedList: any[] = []
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { 
      savedList = await cb([]); 
      return true 
    })
    const res = await addStaff({}, mockFd())
    expect(res).toEqual({ success: true })
    expect(savedList.length).toBe(1)
    expect(savedList[0].id).toMatch(/^st_12345678-1234-1234-1234-123456789012$/)
  })

  it('addStaff rejects duplicate staff', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      // Mock existing staff with same name, phone, and branchId
      await cb([{ id: 'st_old', name: 'test_value', phone: 'test_value', branchId: 'b1', isActive: true }])
      return true
    })
    const res = await addStaff({}, mockFd())
    expect(res).toEqual({ error: 'A staff member with this name and phone number already exists in this branch' })
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

  it('updateStaff rejects duplicate staff on name/mobile change', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([
        { id: 'test_value', name: 'Old', phone: 'old', branchId: 'b1', isActive: true },
        { id: 'other_id', name: 'test_value', phone: 'test_value', branchId: 'b1', isActive: true }
      ])
      return true
    })
    const res = await updateStaff({}, mockFd({ status: 'active', branchId: 'b1' }))
    expect(res).toEqual({ error: 'A staff member with this name and phone number already exists in this branch' })
  })

  it('updateStaff handles branch access error', async () => {
    vi.mocked(auth.requireBranchAccess).mockRejectedValueOnce(new Error('Forbidden'))
    const res = await updateStaff({}, mockFd({ status: 'active', branchId: 'b1' }))
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('updateStaff rejects cross-branch edit for branch manager', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'test_value', name: 'Old', isActive: false, branchId: 'b2' }])
      return true
    })
    const res = await updateStaff({}, mockFd({ status: 'active', branchId: 'b1' }))
    expect(res).toEqual({ error: 'Forbidden: Cannot edit staff from another branch' })
  })

  it('updateStaff handles positionId change and generates index', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      const list = await cb([
        { id: 'test_value', name: 'Old', isActive: true, branchId: 'b1', positionId: 'old_pos' },
        { id: 'other', name: 'Other', isActive: true, positionId: 'new_pos', positionIndex: 0 }
      ])
      expect(list[0].positionIndex).toBe(1)
      return true
    })
    const res = await updateStaff({}, mockFd({ status: 'active', branchId: 'b1', positionId: 'new_pos' }))
    expect(res).toEqual({ success: true })
  })

  it('updateStaff removes positionIndex when positionId is cleared', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      const list = await cb([
        { id: 'test_value', name: 'Old', isActive: true, branchId: 'b1', positionId: 'old_pos', positionIndex: 1 }
      ])
      expect(list[0].positionIndex).toBeUndefined()
      expect(list[0].positionId).toBeUndefined()
      return true
    })
    // mockFd defaults positionId to 'test_value', let's override it to empty string
    const res = await updateStaff({}, mockFd({ status: 'active', branchId: 'b1', positionId: '' }))
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

  it('toggleStaffStatus returns error if unauthorized cross-branch', async () => {
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager', isGlobalAdmin: false, branchId: 'b1' } as any)
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 's1', isActive: true, branchId: 'b2' }])
      return true
    })
    const res = await toggleStaffStatus('s1', true)
    expect(res).toEqual({ error: 'Forbidden: Cannot edit staff from another branch' })
  })

  // ─── deleteStaff ─────────────────────────────────────────────────────────
  it('deleteStaff validates global admin role (only owners can delete)', async () => {
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager', isGlobalAdmin: false } as any)
    const res = await deleteStaff('s1')
    expect(res).toEqual({ error: 'Forbidden: Only owners can delete staff' })
  })

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
