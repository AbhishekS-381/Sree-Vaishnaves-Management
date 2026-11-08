import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addBranch, updateBranch, deleteBranch } from '@/app/actions/branches'
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
  branches: { id: 'id', name: 'name', isActive: 'isActive' },
  staff: { id: 'id', branchId: 'branchId', isActive: 'isActive' },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Branches Actions', () => {
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

  // ─── addBranch ────────────────────────────────────────────────────────────
  it('addBranch validates global admin role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager', isGlobalAdmin: false } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addBranch({}, { get: () => '' } as any)
    expect(res).toEqual({ error: 'Forbidden: Only admin and owner can manage branches' })
  })

  it('addBranch validates missing fields (name/address/phone)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addBranch({}, { get: () => '' } as any)
    expect(res.error).toBeDefined()
  })

  it('addBranch succeeds', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // No duplicate
    mockDb.values.mockResolvedValueOnce([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = { get: (k: string) => k === 'status' ? 'operational' : k === 'gstin' ? '29ABCDE1234F1Z5' : (k.includes('StartTime') ? '12:00' : k.includes('EndTime') ? '13:00' : 'test') } as any
    const res = await addBranch({}, fd)
    expect(res).toEqual({ success: true })
    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({ gstin: '29ABCDE1234F1Z5' }))
  })

  it('addBranch prevents duplicate branch name', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'existing' }]) // Duplicate exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = { get: (k: string) => k === 'status' ? 'operational' : (k.includes('StartTime') ? '12:00' : k.includes('EndTime') ? '13:00' : 'test') } as any
    const res = await addBranch({}, fd)
    expect(res).toEqual({ error: 'A branch with this name already exists' })
  })

  it('addBranch handles concurrent write failure', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    mockDb.values.mockRejectedValueOnce(new Error('Insert failed'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = { get: (k: string) => k === 'status' ? 'operational' : (k.includes('StartTime') ? '12:00' : k.includes('EndTime') ? '13:00' : 'test') } as any
    const res = await addBranch({}, fd)
    expect(res).toEqual({ error: 'Failed to add branch due to a concurrent write.' })
  })

  // ─── updateBranch ────────────────────────────────────────────────────────
  it('updateBranch validates global admin role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager', isGlobalAdmin: false } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateBranch({}, { get: () => '' } as any)
    expect(res).toEqual({ error: 'Forbidden: Only admin and owner can manage branches' })
  })

  it('updateBranch validates missing id/name', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateBranch({}, { get: () => '' } as any)
    expect(res.error).toBeDefined()
  })

  it('updateBranch handles not found', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // Target not found
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateBranch({}, { get: (k: string) => k.includes('StartTime') ? '12:00' : k.includes('EndTime') ? '13:00' : 'test' } as any)
    expect(res).toEqual({ error: 'Not found' })
  })

  it('updateBranch prevents duplicate name on other branch', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'test' }]) // Target found
      .mockResolvedValueOnce([{ id: 'other' }]) // Duplicate found
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateBranch({}, { get: (k: string) => k.includes('StartTime') ? '12:00' : k.includes('EndTime') ? '13:00' : 'test' } as any)
    expect(res).toEqual({ error: 'A branch with this name already exists' })
  })

  it('updateBranch succeeds', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'test' }]) // Target found
      .mockResolvedValueOnce([]) // No duplicate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateBranch({}, { get: (k: string) => k === 'gstin' ? '29ABCDE1234F1Z5' : (k.includes('StartTime') ? '12:00' : k.includes('EndTime') ? '13:00' : 'test') } as any)
    expect(res).toEqual({ success: true })
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ gstin: '29ABCDE1234F1Z5' }))
  })

  it('updateBranch handles transaction failure', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'test' }])
      .mockResolvedValueOnce([])
    mockDb.update.mockImplementationOnce(() => {
      throw new Error('DB error')
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateBranch({}, { get: (k: string) => k.includes('StartTime') ? '12:00' : k.includes('EndTime') ? '13:00' : 'test' } as any)
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── deleteBranch ────────────────────────────────────────────────────────
  it('deleteBranch validates global admin role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager', isGlobalAdmin: false } as any)
    const res = await deleteBranch('b1')
    expect(res).toEqual({ error: 'Forbidden: Only admin and owner can manage branches' })
  })

  it('deleteBranch blocks when active staff exist', async () => {
    mockDb.where.mockResolvedValueOnce([{ count: 3 }])
    const res = await deleteBranch('b1')
    expect(res).toEqual({
      error: 'Cannot delete — 3 active staff member(s) are assigned to this branch. Reassign or deactivate them first.'
    })
  })

  it('deleteBranch handles not found', async () => {
    mockDb.where.mockResolvedValueOnce([{ count: 0 }]) // Staff count 0
    mockDb.limit.mockResolvedValueOnce([]) // Branch not found
    const res = await deleteBranch('b1')
    expect(res).toEqual({ error: 'Branch not found' })
  })

  it('deleteBranch succeeds', async () => {
    mockDb.where.mockResolvedValueOnce([{ count: 0 }]) // Staff count 0
    mockDb.limit.mockResolvedValueOnce([{ id: 'b1' }]) // Branch found
    const res = await deleteBranch('b1')
    expect(res).toEqual({ success: true })
  })

  it('deleteBranch handles transaction failure', async () => {
    mockDb.where.mockResolvedValueOnce([{ count: 0 }])
    mockDb.limit.mockResolvedValueOnce([{ id: 'b1' }])
    mockDb.update.mockImplementationOnce(() => {
      throw new Error('DB error')
    })
    const res = await deleteBranch('b1')
    expect(res).toEqual({ error: 'Transaction failed' })
  })
})
