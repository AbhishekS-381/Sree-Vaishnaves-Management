import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  addDepartment, updateDepartment, deleteDepartment,
  addRole, updateRole, deleteRole
} from '@/app/actions/settings'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn().mockResolvedValue([]),
  writeJSON: vi.fn().mockResolvedValue(true),
  DB_FILES: {
    STAFF: 'staff.json',
    STAFF_REQUIREMENTS: 'requirements.json',
    DEPARTMENTS: 'departments.json',
    ROLES: 'roles.json'
  }
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Settings Actions', () => {
  beforeEach(() => { vi.clearAllMocks() 
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b1')
    vi.spyOn(auth, 'getSessionRole').mockResolvedValue('owner')
  })

  // ─── addDepartment ────────────────────────────────────────────────────────
  it('addDepartment validates admin role', async () => {
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager' } as any)
    const res = await addDepartment({}, { get: () => 'Kitchen' } as any)
    expect(res).toEqual({ error: 'Forbidden: Only admin can manage settings' })
  })

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
  it('updateDepartment validates admin role', async () => {
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager' } as any)
    const res = await updateDepartment({}, { get: () => 'Kitchen' } as any)
    expect(res).toEqual({ error: 'Forbidden: Only admin can manage settings' })
  })

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
  it('deleteDepartment validates admin role', async () => {
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager' } as any)
    const res = await deleteDepartment('d1')
    expect(res).toEqual({ error: 'Forbidden: Only admin can manage settings' })
  })

  it('deleteDepartment handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await deleteDepartment('d1')
    expect(res).toEqual({ error: 'Department not found' })
  })

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
  it('addRole validates admin role', async () => {
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager' } as any)
    const res = await addRole({}, { get: () => 'RoleName' } as any)
    expect(res).toEqual({ error: 'Forbidden: Only admin can manage settings' })
  })

  it('addRole validates name', async () => {
    const res = await addRole({}, { get: () => null, getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Name is required' })
  })

  it('addRole succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await addRole({}, { get: (k: string) => 'RoleName', getAll: () => ['d1'] } as any)
    expect(res).toEqual({ success: true })
  })

  it('addRole rejects already existing role', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'r1', name: 'RoleName', isActive: true }])
      return true
    })
    const res = await addRole({}, { get: (k: string) => 'RoleName', getAll: () => ['d1'] } as any)
    expect(res).toEqual({ error: 'Role name already exists' })
  })

  it('addRole handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const res = await addRole({}, { get: () => 'RoleName', getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Failed to add role' })
  })

  // ─── updateRole ──────────────────────────────────────────────────────────
  it('updateRole validates admin role', async () => {
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager' } as any)
    const res = await updateRole({}, { get: () => 'RoleName' } as any)
    expect(res).toEqual({ error: 'Forbidden: Only admin can manage settings' })
  })

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

  it('updateRole rejects already existing role', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([
        { id: 'r1', name: 'Existing', isActive: true },
        { id: 'test', name: 'Old', isActive: true }
      ])
      return true
    })
    const res = await updateRole({}, { get: (k: string) => k === 'id' ? 'test' : 'Existing', getAll: () => ['d1'] } as any)
    expect(res).toEqual({ error: 'Role name already exists' })
  })

  // ─── deleteRole ──────────────────────────────────────────────────────────
  it('deleteRole validates admin role', async () => {
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager' } as any)
    const res = await deleteRole('r1')
    expect(res).toEqual({ error: 'Forbidden: Only admin can manage settings' })
  })

  it('deleteRole handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await deleteRole('r1')
    expect(res).toEqual({ error: 'Role not found' })
  })

  it('deleteRole rejects if role in use by staff', async () => {
    vi.mocked(db.readJSON).mockImplementation(async (file) => {
      if (file === db.DB_FILES.STAFF) return [{ roleId: 'r1', isActive: true }]
      return []
    })
    const res = await deleteRole('r1')
    expect(res.error).toMatch(/Cannot delete — \d active staff member\(s\) use this role/i)
  })

  it('deleteRole rejects if role in use by open positions', async () => {
    vi.mocked(db.readJSON).mockImplementation(async (file) => {
      if (file === db.DB_FILES.STAFF) return [] // Fix: Return empty staff list
      if (file === db.DB_FILES.STAFF_REQUIREMENTS) return [{ roleId: 'r1', isActive: true }]
      return []
    })
    const res = await deleteRole('r1')
    expect(res.error).toMatch(/Cannot delete — \d open position\(s\) use this role/i)
  })

  it('deleteRole succeeds', async () => {
    vi.mocked(db.readJSON).mockResolvedValue([])
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
