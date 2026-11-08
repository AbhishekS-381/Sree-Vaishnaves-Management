import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  addDepartment, updateDepartment, deleteDepartment,
  addRole, updateRole, deleteRole
} from '@/app/actions/settings'
import * as auth from '@/app/actions/auth'

const { mockDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }
  return { mockDb: mock }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  departments: { id: 'id', name: 'name', isActive: 'isActive' },
  roles: { id: 'id', name: 'name', isActive: 'isActive', departmentIds: 'departmentIds' },
  staff: { id: 'id', roleId: 'roleId', isActive: 'isActive' },
  staffRequirements: { id: 'id', roleId: 'roleId', isActive: 'isActive' },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Settings Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.limit.mockResolvedValue([])
    mockDb.insert.mockReturnThis()
    mockDb.values.mockResolvedValue([])
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b1')
    vi.spyOn(auth, 'getSessionRole').mockResolvedValue('owner')
  })

  // ─── addDepartment ────────────────────────────────────────────────────────
  it('addDepartment validates admin role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager' } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addDepartment({}, { get: () => 'Kitchen' } as any)
    expect(res).toEqual({ error: 'Forbidden: Only admin can manage settings' })
  })

  it('addDepartment validates name', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addDepartment({}, { get: () => null, getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Name is required' })
  })

  it('addDepartment succeeds', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // No duplicate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addDepartment({}, { get: () => 'Kitchen', getAll: () => [] } as any)
    expect(res).toEqual({ success: true })
  })

  it('addDepartment handles duplicate name', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'existing' }])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addDepartment({}, { get: () => 'Kitchen', getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Department name already exists' })
  })

  it('addDepartment handles transaction failure', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    mockDb.values.mockRejectedValueOnce(new Error('Insert error'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addDepartment({}, { get: () => 'Kitchen', getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Failed to add department' })
  })

  // ─── updateDepartment ────────────────────────────────────────────────────
  it('updateDepartment validates admin role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager' } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateDepartment({}, { get: () => 'Kitchen' } as any)
    expect(res).toEqual({ error: 'Forbidden: Only admin can manage settings' })
  })

  it('updateDepartment validates id/name', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateDepartment({}, { get: () => null, getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Invalid data' })
  })

  it('updateDepartment handles not found', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // Target not found
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateDepartment({}, { get: () => 'test', getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Not found' })
  })

  it('updateDepartment rejects duplicate name', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'test' }]) // Target found
      .mockResolvedValueOnce([{ id: 'other' }]) // Duplicate found
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateDepartment({}, { get: () => 'test', getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Department name already exists' })
  })

  it('updateDepartment succeeds', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'test' }]) // Target found
      .mockResolvedValueOnce([]) // No duplicate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateDepartment({}, { get: () => 'test', getAll: () => [] } as any)
    expect(res).toEqual({ success: true })
  })

  it('updateDepartment handles transaction failure', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'test' }])
      .mockResolvedValueOnce([])
    mockDb.update.mockImplementationOnce(() => {
      throw new Error('Update error')
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateDepartment({}, { get: () => 'test', getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── deleteDepartment ────────────────────────────────────────────────────
  it('deleteDepartment validates admin role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager' } as any)
    const res = await deleteDepartment('d1')
    expect(res).toEqual({ error: 'Forbidden: Only admin can manage settings' })
  })

  it('deleteDepartment rejects when role orphaned', async () => {
    mockDb.where.mockResolvedValueOnce([{ name: 'Chef', departmentIds: ['d1'] }])
    const res = await deleteDepartment('d1')
    expect(res.error).toMatch(/Cannot delete — Chef would become unassignable/i)
  })

  it('deleteDepartment handles not found', async () => {
    mockDb.where.mockResolvedValueOnce([]) // No orphaned roles
    mockDb.limit.mockResolvedValueOnce([]) // Dept not found
    const res = await deleteDepartment('d1')
    expect(res).toEqual({ error: 'Department not found' })
  })

  it('deleteDepartment succeeds', async () => {
    mockDb.where.mockResolvedValueOnce([]) // No orphaned roles
    mockDb.limit.mockResolvedValueOnce([{ id: 'd1' }]) // Dept found
    const res = await deleteDepartment('d1')
    expect(res).toEqual({ success: true })
  })

  it('deleteDepartment handles transaction failure', async () => {
    mockDb.where.mockResolvedValueOnce([])
    mockDb.limit.mockResolvedValueOnce([{ id: 'd1' }])
    mockDb.update.mockImplementationOnce(() => {
      throw new Error('Delete error')
    })
    const res = await deleteDepartment('d1')
    expect(res).toEqual({ error: 'Failed to delete department' })
  })

  // ─── addRole ──────────────────────────────────────────────────────────────
  it('addRole validates admin role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager' } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addRole({}, { get: () => 'RoleName' } as any)
    expect(res).toEqual({ error: 'Forbidden: Only admin can manage settings' })
  })

  it('addRole validates name', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addRole({}, { get: () => null, getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Name is required' })
  })

  it('addRole succeeds', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // No duplicate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addRole({}, { get: () => 'RoleName', getAll: () => ['d1'] } as any)
    expect(res).toEqual({ success: true })
  })

  it('addRole rejects already existing role', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'r1' }]) // Duplicate found
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addRole({}, { get: () => 'RoleName', getAll: () => ['d1'] } as any)
    expect(res).toEqual({ error: 'Role name already exists' })
  })

  it('addRole handles transaction failure', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    mockDb.values.mockRejectedValueOnce(new Error('Insert error'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addRole({}, { get: () => 'RoleName', getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Failed to add role' })
  })

  // ─── updateRole ──────────────────────────────────────────────────────────
  it('updateRole validates admin role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager' } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateRole({}, { get: () => 'RoleName' } as any)
    expect(res).toEqual({ error: 'Forbidden: Only admin can manage settings' })
  })

  it('updateRole validates id/name', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateRole({}, { get: () => null, getAll: () => [] } as any)
    expect(res).toEqual({ error: 'Invalid data' })
  })

  it('updateRole handles not found', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // Target not found
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateRole({}, { get: () => 'test', getAll: () => ['d1'] } as any)
    expect(res).toEqual({ error: 'Not found' })
  })

  it('updateRole rejects already existing role', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'test' }]) // Target found
      .mockResolvedValueOnce([{ id: 'r1' }]) // Duplicate found
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateRole({}, { get: (k: string) => k === 'id' ? 'test' : 'Existing', getAll: () => ['d1'] } as any)
    expect(res).toEqual({ error: 'Role name already exists' })
  })

  it('updateRole succeeds', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'test' }])
      .mockResolvedValueOnce([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateRole({}, { get: () => 'test', getAll: () => ['d1'] } as any)
    expect(res).toEqual({ success: true })
  })

  // ─── deleteRole ──────────────────────────────────────────────────────────
  it('deleteRole validates admin role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager' } as any)
    const res = await deleteRole('r1')
    expect(res).toEqual({ error: 'Forbidden: Only admin can manage settings' })
  })

  it('deleteRole rejects if role in use by staff', async () => {
    mockDb.where.mockResolvedValueOnce([{ count: 2 }]) // Staff in use
    const res = await deleteRole('r1')
    expect(res.error).toMatch(/Cannot delete — \d active staff member\(s\) use this role/i)
  })

  it('deleteRole rejects if role in use by open positions', async () => {
    mockDb.where
      .mockResolvedValueOnce([{ count: 0 }]) // Staff not in use
      .mockResolvedValueOnce([{ count: 1 }]) // Reqs in use
    const res = await deleteRole('r1')
    expect(res.error).toMatch(/Cannot delete — \d open position\(s\) use this role/i)
  })

  it('deleteRole handles not found', async () => {
    mockDb.where
      .mockResolvedValueOnce([{ count: 0 }]) // Staff
      .mockResolvedValueOnce([{ count: 0 }]) // Reqs
    mockDb.limit.mockResolvedValueOnce([]) // Role not found
    const res = await deleteRole('r1')
    expect(res).toEqual({ error: 'Role not found' })
  })

  it('deleteRole succeeds', async () => {
    mockDb.where
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
    mockDb.limit.mockResolvedValueOnce([{ id: 'r1' }])
    const res = await deleteRole('r1')
    expect(res).toEqual({ success: true })
  })

  it('deleteRole handles transaction failure', async () => {
    mockDb.where
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
    mockDb.limit.mockResolvedValueOnce([{ id: 'r1' }])
    mockDb.update.mockImplementationOnce(() => {
      throw new Error('Delete error')
    })
    const res = await deleteRole('r1')
    expect(res).toEqual({ error: 'Failed to delete role' })
  })
})
