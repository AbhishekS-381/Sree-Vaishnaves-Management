import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAttendanceByDate, saveAttendance } from '@/app/actions/attendance'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAction: vi.fn() }))
vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ role: 'Staff' }),
  requireBranchAccess: vi.fn().mockResolvedValue('b1')
}))

describe('Attendance Actions', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('getAttendanceByDate succeeds', async () => {
    vi.mocked(db.readJSON).mockResolvedValue([{ date: '2023-10-01', branchId: 'b1' }])
    const res = await getAttendanceByDate('2023-10-01', 'b1')
    expect(res.length).toBe(1)
  })

  it('saveAttendance blocks old dates', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (f, cb) => {
      await cb([])
      return true
    })
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 10)
    const res = await saveAttendance([{ date: oldDate.toISOString(), staffId: 's1' }])
    expect(res).toEqual({ error: 'Cannot save attendance older than 7 days without Admin privileges.' })
  })

  it('saveAttendance creates and updates', async () => {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    vi.mocked(db.withTransaction).mockImplementation(async (f, cb) => {
      await cb([{ date: todayStr, staffId: 's1' }])
      return true
    })
    const res = await saveAttendance([{ date: todayStr, staffId: 's1' }, { date: todayStr, staffId: 's2' }])
    expect(res).toEqual({ success: true })
  })
})
