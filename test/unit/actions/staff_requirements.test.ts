import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveRequirement, deleteRequirement, updateRequirementSchedules } from '@/app/actions/staff_requirements'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Staff Requirements Actions', () => {
  beforeEach(() => { vi.resetAllMocks() })

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

  it('saveRequirement updates existing by match (no id)', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'req1', branchId: 'b1', departmentId: 'd1', roleId: 'r1', requiredCount: 2, specialtyId: undefined }])
      return true
    })
    const res = await saveRequirement(null, 'b1', 'd1', 'r1', 5, undefined)
    expect(res).toEqual({ success: true })
  })

  it('saveRequirement handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const res = await saveRequirement(null, 'b1', 'd1', 'r1', 3)
    expect(res).toEqual({ error: 'Failed to save requirement' })
  })

  it('deleteRequirement succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'req1' }])
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
    const schedules = [{
      positionIndex: 0,
      shifts: [
        { id: '1', start: '06:00', end: '11:00' }, // 5 hrs
        { id: '2', start: '12:00', end: '16:00' }  // 4 hrs = 9 total
      ]
    }]
    const res = await updateRequirementSchedules('req1', schedules)
    expect(res.error).toMatch(/Total shift hours must be exactly 10 hours/)
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
})
