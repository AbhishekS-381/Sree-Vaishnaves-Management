import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveRequirement, deleteRequirement, updateRequirementSchedules } from '@/app/actions/staff_requirements'

const { mockDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryBuilder: any = {
    where: vi.fn(),
    limit: vi.fn(),
  }
  queryBuilder.where.mockReturnValue(queryBuilder)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateBuilder: any = {
    set: vi.fn(),
    where: vi.fn().mockResolvedValue([]),
  }
  updateBuilder.set.mockReturnValue(updateBuilder)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deleteBuilder: any = {
    where: vi.fn().mockResolvedValue([]),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    _whereResult: [],
    _limitResult: [],
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnValue(queryBuilder),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnValue(updateBuilder),
    delete: vi.fn().mockReturnValue(deleteBuilder),
    _queryBuilder: queryBuilder,
    _updateBuilder: updateBuilder,
    _deleteBuilder: deleteBuilder,
  }

  queryBuilder.then = (resolve: any, reject: any) =>
    Promise.resolve(mock._whereResult).then(resolve, reject)
  queryBuilder.catch = (fn: any) =>
    Promise.resolve(mock._whereResult).catch(fn)
  queryBuilder.limit.mockImplementation(() => Promise.resolve(mock._limitResult))

  return { mockDb: mock }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  staff: {
    id: 'id',
    positionId: 'positionId',
    positionIndex: 'positionIndex',
    isActive: 'isActive',
    deletedAt: 'deletedAt',
  },
  staffRequirements: {
    id: 'id',
    branchId: 'branchId',
    departmentId: 'departmentId',
    roleId: 'roleId',
    specialtyId: 'specialtyId',
    requiredCount: 'requiredCount',
    defaultSalary: 'defaultSalary',
    startTime: 'startTime',
    endTime: 'endTime',
    responsibility: 'responsibility',
    schedules: 'schedules',
    isActive: 'isActive',
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn(() => ({ role: 'admin', isGlobalAdmin: true, isGlobalOwner: true, branchId: 'b1' })),
  requireBranchAccess: vi.fn(async (b) => b || 'b1'),
}))

describe('Staff Requirements Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb._whereResult = []
    mockDb._limitResult = []
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnValue(mockDb._queryBuilder)
    mockDb._queryBuilder.where.mockReturnValue(mockDb._queryBuilder)
    mockDb._queryBuilder.limit.mockImplementation(() => Promise.resolve(mockDb._limitResult))
    mockDb.insert.mockReturnThis()
    mockDb.values.mockResolvedValue([])
    mockDb.update.mockReturnValue(mockDb._updateBuilder)
    mockDb._updateBuilder.set.mockReturnValue(mockDb._updateBuilder)
    mockDb._updateBuilder.where.mockResolvedValue([])
    mockDb.delete.mockReturnValue(mockDb._deleteBuilder)
    mockDb._deleteBuilder.where.mockResolvedValue([])
  })

  it('saveRequirement creates new requirement', async () => {
    mockDb._limitResult = [] // no duplicate
    const res = await saveRequirement(null, 'b1', 'd1', 'r1', 3)
    expect(res).toEqual({ success: true })
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('saveRequirement updates existing by id', async () => {
    mockDb._limitResult = []
    mockDb._queryBuilder.limit
      .mockResolvedValueOnce([{ id: 'req1', roleId: 'r1', departmentId: 'd1' }]) // existingReq
      .mockResolvedValueOnce([]) // no duplicate
    const res = await saveRequirement('req1', 'b1', 'd1', 'r1', 5)
    expect(res).toEqual({ success: true })
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('saveRequirement blocks role/department changes when staff assigned', async () => {
    mockDb._queryBuilder.limit.mockResolvedValueOnce([{ id: 'req1', roleId: 'oldRole', departmentId: 'oldDept' }])
    mockDb._whereResult = [{ id: 's1' }] // linked active staff
    const res = await saveRequirement('req1', 'b1', 'newDept', 'newRole', 5)
    expect(res.error).toMatch(/Cannot change role\/department/)
  })

  it('saveRequirement warns when requiredCount is reduced below filled count', async () => {
    mockDb._queryBuilder.limit
      .mockResolvedValueOnce([{ id: 'req1', roleId: 'r1', departmentId: 'd1' }]) // existingReq
      .mockResolvedValueOnce([]) // no duplicate
    mockDb._whereResult = [{ id: 's1' }, { id: 's2' }] // 2 linked staff
    const res = await saveRequirement('req1', 'b1', 'd1', 'r1', 1) // 1 required < 2 filled
    expect(res).toEqual({ success: true, warning: '1 staff member(s) exceed the new headcount. Please reassign them.' })
  })

  it('saveRequirement rejects duplicate by match (no id)', async () => {
    mockDb._limitResult = [{ id: 'req1' }] // duplicate exists
    const res = await saveRequirement(null, 'b1', 'd1', 'r1', 5, undefined)
    expect(res).toEqual({ error: 'A position with this Role, Department, and Branch already exists.' })
  })

  it('saveRequirement handles db failure', async () => {
    mockDb._limitResult = []
    mockDb.values.mockRejectedValueOnce(new Error('db down'))
    const res = await saveRequirement(null, 'b1', 'd1', 'r1', 3)
    expect(res).toEqual({ error: 'Failed to save requirement' })
  })

  it('deleteRequirement succeeds and cascades to staff', async () => {
    const res = await deleteRequirement('req1')
    expect(res).toEqual({ success: true })
    expect(mockDb.update).toHaveBeenCalled()
    expect(mockDb.delete).toHaveBeenCalled()
  })

  it('deleteRequirement handles db failure', async () => {
    mockDb._deleteBuilder.where.mockRejectedValueOnce(new Error('db down'))
    const res = await deleteRequirement('req1')
    expect(res).toEqual({ error: 'Failed to delete requirement' })
  })

  // ─── Shift Scheduling Validations ──────────────────────────────────────────
  it('Position schedule with exactly 10 total hours — saves successfully', async () => {
    const schedules = [{
      positionIndex: 0,
      shifts: [
        { id: '1', start: '06:00', end: '11:00' }, // 5 hrs
        { id: '2', start: '12:00', end: '17:00' }  // 5 hrs
      ]
    }]
    const res = await updateRequirementSchedules('req1', schedules)
    expect(res).toEqual({ success: true })
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('Position schedule with total hours > 10 — returns validation error', async () => {
    const schedules = [{
      positionIndex: 0,
      shifts: [
        { id: '1', start: '06:00', end: '11:00' }, // 5 hrs
        { id: '2', start: '12:00', end: '18:00' }  // 6 hrs = 11 total
      ]
    }]
    const res = await updateRequirementSchedules('req1', schedules)
    expect(res.error).toMatch(/Total shift hours cannot exceed 10 hours/i)
  })

  it('More than 3 segments — returns validation error', async () => {
    const schedules = [{
      positionIndex: 0,
      shifts: [
        { id: '1', start: '06:00', end: '08:30' },
        { id: '2', start: '09:30', end: '12:00' },
        { id: '3', start: '13:00', end: '15:30' },
        { id: '4', start: '16:30', end: '19:00' } // 4 segments!
      ]
    }]
    const res = await updateRequirementSchedules('req1', schedules)
    expect(res.error).toMatch(/Maximum 3 shifts allowed/)
  })

  it('Break gap less than 1 hour — returns validation error', async () => {
    const schedules = [{
      positionIndex: 0,
      shifts: [
        { id: '1', start: '06:00', end: '11:00' },
        { id: '2', start: '11:30', end: '16:30' } // 30 min break
      ]
    }]
    const res = await updateRequirementSchedules('req1', schedules)
    expect(res.error).toMatch(/Minimum 1 hour break required/)
  })

  it('Segment starting before 5am — returns validation error', async () => {
    const schedules = [{
      positionIndex: 0,
      shifts: [{ id: '1', start: '04:00', end: '14:00' }]
    }]
    const res = await updateRequirementSchedules('req1', schedules)
    expect(res.error).toMatch(/cannot start before 05:00/)
  })

  it('Segment ending after 11pm — returns validation error', async () => {
    const schedules = [{
      positionIndex: 0,
      shifts: [{ id: '1', start: '13:00', end: '23:30' }]
    }]
    const res = await updateRequirementSchedules('req1', schedules)
    expect(res.error).toMatch(/cannot end after 23:00/)
  })

  it('updateRequirementSchedules handles db failure', async () => {
    mockDb._updateBuilder.where.mockRejectedValueOnce(new Error('db down'))
    const schedules = [{
      positionIndex: 0,
      shifts: [{ id: '1', start: '10:00', end: '15:00' }]
    }]
    const res = await updateRequirementSchedules('req1', schedules)
    expect(res).toEqual({ error: 'Failed to update schedules' })
  })
})
