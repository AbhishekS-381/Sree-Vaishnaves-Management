import { describe, it, expect, vi, beforeEach } from 'vitest'
import { savePayroll, markAsPaid } from '@/app/actions/salary'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn().mockResolvedValue([]),
  writeJSON: vi.fn().mockResolvedValue(true),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Salary Actions', () => {
  beforeEach(() => { vi.clearAllMocks() 
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b1')
    vi.spyOn(auth, 'getSessionRole').mockResolvedValue('owner')
  })

  it('savePayroll returns error on invalid date (no month/year)', async () => {
    const fd = { get: () => null, entries: () => [] } as any
    const res = await savePayroll({}, fd)
    // salary.ts returns 'Invalid Date Selection' when month/year are falsy
    expect(res).toEqual({ error: 'Invalid Date Selection' })
  })

  it('savePayroll succeeds with valid month/year', async () => {
    vi.mocked(db.readJSON).mockResolvedValue([
      { id: 's1', name: 'Alice', monthlySalary: 3000 }
    ])
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([])
      return true
    })
    const fd = {
      get: (k: string) => {
        if (k === 'month') return '10'
        if (k === 'year') return '2023'
        return null
      },
      entries: () => [
        ['staff_s1_days', '25'],
        ['staff_s1_notes', 'Good'],
        ['staff_s1_advances', '200'],
      ]
    } as any
    const res = await savePayroll({}, fd)
    expect((res as any).success).toBe(true)
  })

  it('savePayroll filters staff for non-admins', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'manager', isGlobalAdmin: false, branchId: 'b1' } as any)
    vi.mocked(db.readJSON).mockResolvedValue([
      { id: 's1', name: 'Alice', branchId: 'b1', monthlySalary: 3000 },
      { id: 's2', name: 'Bob', branchId: 'b2', monthlySalary: 4000 }
    ])
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      const records = await cb([])
      // Should only include s1, not s2
      expect(records.some((r: any) => r.staffId === 's2')).toBe(false)
      expect(records.some((r: any) => r.staffId === 's1')).toBe(true)
      return true
    })
    const fd = {
      get: (k: string) => k === 'month' ? '10' : k === 'year' ? '2023' : null,
      entries: () => [
        ['staff_s1_days', '25'],
        ['staff_s2_days', '30'] // This should be ignored due to branchId
      ]
    } as any
    await savePayroll({}, fd)
  })

  it('savePayroll handles transaction failure', async () => {
    vi.mocked(db.readJSON).mockResolvedValue([])
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const fd = {
      get: (k: string) => k === 'month' ? '10' : k === 'year' ? '2023' : null,
      entries: () => []
    } as any
    const res = await savePayroll({}, fd)
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  it('markAsPaid handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([])
      return true
    })
    const res = await markAsPaid('p1')
    expect(res).toEqual({ error: 'Record not found' })
  })

  it('markAsPaid succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'p1', isPaid: false }])
      return true
    })
    const res = await markAsPaid('p1')
    expect(res).toEqual({ success: true })
  })
})
