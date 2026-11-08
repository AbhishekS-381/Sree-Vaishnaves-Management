import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addStaff, updateStaff, toggleStaffStatus, deleteStaff } from '@/app/actions/staff'
import * as auth from '@/app/actions/auth'

const { mockDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    then: undefined,
  }
  return { mockDb: mock }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  staff: {
    id: 'id',
    name: 'name',
    phone: 'phone',
    branchId: 'branchId',
    departmentId: 'departmentId',
    roleId: 'roleId',
    label: 'label',
    monthlySalary: 'monthlySalary',
    isActive: 'isActive',
    joinedAt: 'joinedAt',
    exitDate: 'exitDate',
    shiftType: 'shiftType',
    specialtyId: 'specialtyId',
    positionId: 'positionId',
    positionIndex: 'positionIndex',
    startTime: 'startTime',
    endTime: 'endTime',
    deletedAt: 'deletedAt',
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAction: vi.fn().mockResolvedValue(true) }))

const mockFd = (overrides: Record<string, string | null> = {}) => ({
  get: (k: string) => {
    if (overrides[k] !== undefined) return overrides[k]
    switch (k) {
      case 'name': return 'Valid Name'
      case 'phone': return '1234567890'
      case 'branchId': return 'b1'
      case 'departmentId': return 'd1'
      case 'roleId': return 'r1'
      case 'salary': return '1000'
      case 'shiftType': return 'full'
      case 'id': return 'test_value'
      default: return ''
    }
  }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as FormData)

describe('Staff Actions', () => {
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
    vi.spyOn(auth, 'getSession').mockResolvedValue({ userId: 'test-user', role: 'admin', isGlobalAdmin: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockImplementation(async (b) => (b as string) || 'b1')
  })

  // ─── addStaff ──────────────────────────────────────────────────────────────
  it('addStaff validates missing fields', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addStaff({}, { get: () => null } as any)
    expect(res?.error).toBeDefined()
  })

  it('addStaff succeeds and inserts staff', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // no duplicate
    const res = await addStaff({}, mockFd())
    expect(res).toEqual({ success: true })
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('addStaff rejects duplicate staff', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'st_old' }])
    const res = await addStaff({}, mockFd({ name: 'Valid Name', phone: '1234567890' }))
    expect(res).toEqual({ error: 'A staff member with this name and phone number already exists in this branch' })
  })

  it('addStaff handles db failure', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    mockDb.values.mockRejectedValueOnce(new Error('db down'))
    const res = await addStaff({}, mockFd())
    expect(res).toEqual({ error: 'Failed to save data' })
  })

  // ─── updateStaff ──────────────────────────────────────────────────────────
  it('updateStaff validates invalid id/name', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateStaff({}, { get: () => null } as any)
    expect(res?.error).toBeDefined()
  })

  it('updateStaff handles not found', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // not found
    const res = await updateStaff({}, mockFd({ status: 'active' }))
    expect(res).toEqual({ error: 'Staff not found' })
  })

  it('updateStaff succeeds', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'test_value', name: 'Old', isActive: false, branchId: 'b1', positionIndex: 0 }])
      .mockResolvedValueOnce([]) // no duplicate
    const res = await updateStaff({}, mockFd({ status: 'active', branchId: 'b1' }))
    expect(res).toEqual({ success: true })
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('updateStaff rejects duplicate staff on name/mobile change', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'test_value', name: 'Old', phone: 'old', branchId: 'b1', isActive: true }])
      .mockResolvedValueOnce([{ id: 'other_id' }]) // duplicate exists
    const res = await updateStaff({}, mockFd({ id: 'test_value', name: 'Valid Name', phone: '1234567890', branchId: 'b1' }))
    expect(res).toEqual({ error: 'A staff member with this name and phone number already exists in this branch' })
  })

  it('updateStaff handles branch access error', async () => {
    vi.mocked(auth.requireBranchAccess).mockRejectedValueOnce(new Error('Forbidden'))
    const res = await updateStaff({}, mockFd({ status: 'active', branchId: 'b1' }))
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('updateStaff rejects cross-branch edit for branch manager', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'test_value', name: 'Old', isActive: false, branchId: 'b2' }])
    const res = await updateStaff({}, mockFd({ status: 'active', branchId: 'b1' }))
    expect(res).toEqual({ error: 'Forbidden: Cannot edit staff from another branch' })
  })

  it('updateStaff handles positionId change and generates index', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'test_value', name: 'Old', isActive: true, branchId: 'b1', positionId: 'old_pos', positionIndex: 0 }])
      .mockResolvedValueOnce([]) // no duplicate
    // select existing indices query (not limit-terminated, but where-terminated)
    mockDb.where.mockReturnValueOnce(mockDb) // for target
      .mockReturnValueOnce(mockDb) // for duplicate
      .mockResolvedValueOnce([{ positionIndex: 0 }]) // for existingIndices

    let updatedSet: any = null
    mockDb.set.mockImplementationOnce((val: any) => {
      updatedSet = val
      return mockDb
    })

    const res = await updateStaff({}, mockFd({ status: 'active', branchId: 'b1', positionId: 'new_pos' }))
    expect(res).toEqual({ success: true })
    expect(updatedSet?.positionIndex).toBe(1)
  })

  it('updateStaff removes positionIndex when positionId is cleared', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'test_value', name: 'Old', isActive: true, branchId: 'b1', positionId: 'old_pos', positionIndex: 1 }])
      .mockResolvedValueOnce([]) // no duplicate

    let updatedSet: any = null
    mockDb.set.mockImplementationOnce((val: any) => {
      updatedSet = val
      return mockDb
    })

    const res = await updateStaff({}, mockFd({ status: 'active', branchId: 'b1', positionId: '' }))
    expect(res).toEqual({ success: true })
    expect(updatedSet?.positionIndex).toBeNull()
    expect(updatedSet?.positionId).toBeNull()
  })

  // ─── toggleStaffStatus ────────────────────────────────────────────────────
  it('toggleStaffStatus handles not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await toggleStaffStatus('s1', true)
    expect(res).toEqual({ error: 'Staff not found' })
  })

  it('toggleStaffStatus succeeds', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 's1', isActive: true, branchId: 'b1' }])
    const res = await toggleStaffStatus('s1', true)
    expect(res).toEqual({ success: true })
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('toggleStaffStatus returns error if unauthorized cross-branch', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager', isGlobalAdmin: false, branchId: 'b1' } as any)
    mockDb.limit.mockResolvedValueOnce([{ id: 's1', isActive: true, branchId: 'b2' }])
    const res = await toggleStaffStatus('s1', true)
    expect(res).toEqual({ error: 'Forbidden: Cannot edit staff from another branch' })
  })

  // ─── deleteStaff ─────────────────────────────────────────────────────────
  it('deleteStaff validates global admin role (only owners can delete)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager', isGlobalAdmin: false } as any)
    const res = await deleteStaff('s1')
    expect(res).toEqual({ error: 'Forbidden: Only owners can delete staff' })
  })

  it('deleteStaff handles not found', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    const res = await deleteStaff('s1')
    expect(res).toEqual({ error: 'Staff not found' })
  })

  it('deleteStaff succeeds', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 's1' }])
    const res = await deleteStaff('s1')
    expect(res).toEqual({ success: true })
    expect(mockDb.update).toHaveBeenCalled()
  })
})
