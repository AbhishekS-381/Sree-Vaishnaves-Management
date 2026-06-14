import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveRequirement, deleteRequirement } from '@/app/actions/staff_requirements'
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
})
