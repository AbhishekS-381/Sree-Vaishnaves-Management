import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAttendanceByDate, saveAttendance } from '@/app/actions/attendance'
import * as auth from '@/app/actions/auth'

const { mockDb, mockWithDbTransaction } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertBuilder: any = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue([]),
  }
  insertBuilder.values.mockReturnValue(insertBuilder)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    _selectResult: [],
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => Promise.resolve(mock._selectResult)),
    insert: vi.fn().mockReturnValue(insertBuilder),
    _insertBuilder: insertBuilder,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockWithTx = vi.fn().mockImplementation(async (cb: any) => cb(mock))

  return { mockDb: mock, mockWithDbTransaction: mockWithTx }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  attendance: {
    id: 'id',
    date: 'date',
    staffId: 'staffId',
    branchId: 'branchId',
    status: 'status',
    shiftsWorked: 'shiftsWorked',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  withDbTransaction: mockWithDbTransaction,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAction: vi.fn().mockResolvedValue(true) }))
vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ role: 'manager', isGlobalAdmin: false }),
  requireBranchAccess: vi.fn().mockResolvedValue('b1'),
}))

describe('Attendance Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb._selectResult = []
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockImplementation(() => Promise.resolve(mockDb._selectResult))
    mockDb.insert.mockReturnValue(mockDb._insertBuilder)
    mockDb._insertBuilder.values.mockReturnValue(mockDb._insertBuilder)
    mockDb._insertBuilder.onConflictDoUpdate.mockResolvedValue([])
    mockWithDbTransaction.mockImplementation(async (cb: any) => cb(mockDb))
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'manager', isGlobalAdmin: false } as any)
    vi.mocked(auth.requireBranchAccess).mockResolvedValue('b1')
  })

  it('getAttendanceByDate succeeds', async () => {
    mockDb._selectResult = [
      {
        id: 'att_1',
        date: '2023-10-01',
        branchId: 'b1',
        staffId: 's1',
        status: 'present',
        shiftsWorked: [],
        updatedAt: new Date('2023-10-01T10:00:00Z'),
      },
    ]
    const res = await getAttendanceByDate('2023-10-01', 'b1')
    expect(res.length).toBe(1)
    expect(res[0].id).toBe('att_1')
  })

  it('saveAttendance blocks old dates for non-global-admin', async () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 10)
    const res = await saveAttendance([{ date: oldDate.toISOString().split('T')[0], staffId: 's1' }])
    expect(res).toEqual({ error: 'Cannot save attendance older than 7 days without Owner privileges.' })
  })

  it('saveAttendance allows old dates for global admin', async () => {
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'admin', isGlobalAdmin: true } as any)
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 10)
    const res = await saveAttendance([{ date: oldDate.toISOString().split('T')[0], staffId: 's1' }])
    expect(res).toEqual({ success: true })
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('saveAttendance creates and updates via upsert', async () => {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    const res = await saveAttendance([
      { date: todayStr, staffId: 's1' },
      { date: todayStr, staffId: 's2' },
    ])
    expect(res).toEqual({ success: true })
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('saveAttendance batches multiple records into a single values call', async () => {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    const res = await saveAttendance([
      { date: todayStr, staffId: 's1', status: 'present' },
      { date: todayStr, staffId: 's2', status: 'absent' },
      { date: todayStr, staffId: 's3', status: 'half-day' },
    ])
    expect(res).toEqual({ success: true })
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
    expect(mockDb._insertBuilder.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ staffId: 's1', status: 'present' }),
        expect.objectContaining({ staffId: 's2', status: 'absent' }),
        expect.objectContaining({ staffId: 's3', status: 'half-day' }),
      ])
    )
  })

  it('saveAttendance handles branch access error', async () => {
    vi.mocked(auth.requireBranchAccess).mockRejectedValueOnce(new Error('Forbidden'))
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    const res = await saveAttendance([{ date: todayStr, staffId: 's1', branchId: 'b2' }])
    expect(res).toEqual({ error: 'Forbidden: Branch access denied.' })
  })

  it('saveAttendance blocks future dates', async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 2)
    const res = await saveAttendance([{ date: futureDate.toISOString().split('T')[0], staffId: 's1' }])
    expect(res).toEqual({ error: 'Cannot mark attendance for future dates' })
  })

  it('saveAttendance handles transaction failure', async () => {
    mockWithDbTransaction.mockRejectedValueOnce(new Error('db down'))
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    const res = await saveAttendance([{ date: todayStr, staffId: 's1' }])
    expect(res).toEqual({ error: 'Transaction failed' })
  })
})
