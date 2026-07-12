import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveRequirement, deleteRequirement, updateRequirementSchedules } from '@/app/actions/staff_requirements'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn().mockResolvedValue([]),
  writeJSON: vi.fn().mockResolvedValue(true),
  DB_FILES: {
    STAFF: 'staff.json',
    STAFF_REQUIREMENTS: 'reqs.json'
  }
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn(() => ({ role: 'admin', isGlobalAdmin: true, isGlobalOwner: true, branchId: 'b1' })),
  requireBranchAccess: vi.fn(async (b) => b || 'b1')
}))

describe('Staff Requirements Actions', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('saveRequirement creates new requirement', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await saveRequirement(null, 'b1', 'd1', 'r1', 3)
    expect(res).toEqual({ success: true })
  })

  it('saveRequirement updates existing by id', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'req1', branchId: 'b1', departmentId: 'd1', roleId: 'r1', requiredCount: 2 }])
      return true
    })
    const res = await saveRequirement('req1', 'b1', 'd1', 'r1', 5)
    expect(res).toEqual({ success: true })
  })

  it('saveRequirement blocks role/department changes when staff assigned', async () => {
    vi.mocked(db.readJSON).mockImplementation(async (file) => {
      if (file === db.DB_FILES.STAFF_REQUIREMENTS) {
        return [{ id: 'req1', roleId: 'oldRole', departmentId: 'oldDept' }]
      }
      if (file === db.DB_FILES.STAFF) {
        return [{ positionId: 'req1', isActive: true }]
      }
      return []
    })
    const res = await saveRequirement('req1', 'b1', 'newDept', 'newRole', 5)
    expect(res.error).toMatch(/Cannot change role\/department/)
  })

  it('saveRequirement warns when requiredCount is reduced below filled count', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'req1', branchId: 'b1', departmentId: 'd1', roleId: 'r1', requiredCount: 5 }])
      return true
    })
    vi.mocked(db.readJSON).mockImplementation(async (file) => {
      if (file === db.DB_FILES.STAFF_REQUIREMENTS) return [{ id: 'req1', roleId: 'r1', departmentId: 'd1' }]
      if (file === db.DB_FILES.STAFF) {
        return [
          { positionId: 'req1', isActive: true },
          { positionId: 'req1', isActive: true }
        ] // 2 filled
      }
      return []
    })
    const res = await saveRequirement('req1', 'b1', 'd1', 'r1', 1) // Set to 1, but 2 are filled
    expect(res).toEqual({ success: true, warning: '1 staff member(s) exceed the new headcount. Please reassign them.' })
  })

  it('saveRequirement rejects duplicate by match (no id)', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'req1', branchId: 'b1', departmentId: 'd1', roleId: 'r1', requiredCount: 2, specialtyId: undefined }])
      return true
    })
    const res = await saveRequirement(null, 'b1', 'd1', 'r1', 5, undefined)
    expect(res).toEqual({ error: 'A position with this Role, Department, and Branch already exists.' })
  })

  it('saveRequirement handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const res = await saveRequirement(null, 'b1', 'd1', 'r1', 3)
    expect(res).toEqual({ error: 'Failed to save requirement' })
  })

  it('deleteRequirement succeeds and keeps other requirements', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (file, cb) => {
      if (file === db.DB_FILES.STAFF) {
        const staff = await cb([{ positionId: 'req1' }])
        expect(staff[0].positionId).toBeUndefined()
        return true
      }
      if (file === db.DB_FILES.STAFF_REQUIREMENTS) {
        const reqs = await cb([{ id: 'req1' }, { id: 'other' }])
        expect(reqs).toHaveLength(1)
        expect(reqs[0].id).toBe('other')
        return true
      }
      return true
    })
    const res = await deleteRequirement('req1')
    expect(res).toEqual({ success: true })
  })

  it('deleteRequirement handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const res = await deleteRequirement('req1')
    expect(res).toEqual({ error: 'Failed to delete requirement' })
  })

  // ─── Shift Scheduling Validations ──────────────────────────────────────────
  it('Position schedule with exactly 10 total hours — saves successfully', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'req1' }])
      return true
    })
    const schedules = [{
      positionIndex: 0,
      shifts: [
        { id: '1', start: '06:00', end: '11:00' }, // 5 hrs
        { id: '2', start: '12:00', end: '17:00' }  // 5 hrs
      ]
    }]
    const res = await updateRequirementSchedules('req1', schedules)
    expect(res).toEqual({ success: true })
  })

  it('Position schedule with total hours ≠ 10 — returns validation error', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'req1' }])
      return true
    })
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
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'req1' }])
      return true
    })
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
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'req1' }])
      return true
    })
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
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'req1' }])
      return true
    })
    const schedules = [{
      positionIndex: 0,
      shifts: [{ id: '1', start: '04:00', end: '14:00' }]
    }]
    const res = await updateRequirementSchedules('req1', schedules)
    expect(res.error).toMatch(/cannot start before 05:00/)
  })

  it('Segment ending after 11pm — returns validation error', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'req1' }])
      return true
    })
    const schedules = [{
      positionIndex: 0,
      shifts: [{ id: '1', start: '13:00', end: '23:30' }]
    }]
    const res = await updateRequirementSchedules('req1', schedules)
    expect(res.error).toMatch(/cannot end after 23:00/)
  })

  it('updateRequirementSchedules handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const schedules = [{
      positionIndex: 0,
      shifts: [{ id: '1', start: '10:00', end: '15:00' }]
    }]
    const res = await updateRequirementSchedules('req1', schedules)
    expect(res).toEqual({ error: 'Failed to update schedules' })
  })
})
