import { describe, it, expect, vi, beforeEach } from 'vitest'
import { savePayroll, markAsPaid } from '@/app/actions/salary'
import * as auth from '@/app/actions/auth'

const { mockDb, mockWithDbTransaction } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryBuilder: any = {
    where: vi.fn(),
    limit: vi.fn(),
  }
  queryBuilder.where.mockReturnValue(queryBuilder)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertBuilder: any = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue([]),
  }
  insertBuilder.values.mockReturnValue(insertBuilder)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateBuilder: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  }
  updateBuilder.set.mockReturnValue(updateBuilder)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    _selectResult: [],
    _limitResult: [],
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnValue(queryBuilder),
    insert: vi.fn().mockReturnValue(insertBuilder),
    update: vi.fn().mockReturnValue(updateBuilder),
    _queryBuilder: queryBuilder,
    _insertBuilder: insertBuilder,
    _updateBuilder: updateBuilder,
  }

  queryBuilder.then = (resolve: any, reject: any) =>
    Promise.resolve(mock._selectResult).then(resolve, reject)
  queryBuilder.catch = (fn: any) =>
    Promise.resolve(mock._selectResult).catch(fn)
  queryBuilder.limit.mockImplementation(() => Promise.resolve(mock._limitResult))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockWithTx = vi.fn().mockImplementation(async (cb: any) => cb(mock))

  return { mockDb: mock, mockWithDbTransaction: mockWithTx }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  payroll: {
    id: 'id',
    staffId: 'staffId',
    branchId: 'branchId',
    name: 'name',
    month: 'month',
    year: 'year',
    monthlySalary: 'monthlySalary',
    daysWorked: 'daysWorked',
    advances: 'advances',
    payableAmount: 'payableAmount',
    status: 'status',
    notes: 'notes',
    paidAt: 'paidAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  staff: {
    id: 'id',
    name: 'name',
    branchId: 'branchId',
    monthlySalary: 'monthlySalary',
    isActive: 'isActive',
    deletedAt: 'deletedAt',
  },
  withDbTransaction: mockWithDbTransaction,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Salary Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb._selectResult = []
    mockDb._limitResult = []
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnValue(mockDb._queryBuilder)
    mockDb._queryBuilder.where.mockReturnValue(mockDb._queryBuilder)
    mockDb._queryBuilder.limit.mockImplementation(() => Promise.resolve(mockDb._limitResult))
    mockDb.insert.mockReturnValue(mockDb._insertBuilder)
    mockDb._insertBuilder.values.mockReturnValue(mockDb._insertBuilder)
    mockDb._insertBuilder.onConflictDoUpdate.mockResolvedValue([])
    mockDb.update.mockReturnValue(mockDb._updateBuilder)
    mockDb._updateBuilder.set.mockReturnValue(mockDb._updateBuilder)
    mockDb._updateBuilder.where.mockResolvedValue([])
    mockWithDbTransaction.mockImplementation(async (cb: any) => cb(mockDb))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b1')
    vi.spyOn(auth, 'getSessionRole').mockResolvedValue('owner')
  })

  it('savePayroll returns error on invalid date (no month/year)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = { get: () => null, entries: () => [] } as any
    const res = await savePayroll({}, fd)
    expect(res).toEqual({ error: 'Invalid Date Selection' })
  })

  it('savePayroll succeeds with valid month/year', async () => {
    mockDb._selectResult = [{ id: 's1', name: 'Alice', branchId: 'b1', monthlySalary: 3000 }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      ],
    } as any
    const res = await savePayroll({}, fd)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((res as any).success).toBe(true)
    expect(mockWithDbTransaction).toHaveBeenCalled()
    expect(mockDb._insertBuilder.onConflictDoUpdate).toHaveBeenCalled()
  })

  it('savePayroll filters staff for non-admins', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'manager', isGlobalAdmin: false, branchId: 'b1' } as any)
    mockDb._selectResult = [{ id: 's1', name: 'Alice', branchId: 'b1', monthlySalary: 3000 }]

    const insertedRecords: any[] = []
    mockDb._insertBuilder.values.mockImplementation((val: any) => {
      insertedRecords.push(val)
      return mockDb._insertBuilder
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => (k === 'month' ? '10' : k === 'year' ? '2023' : null),
      entries: () => [
        ['staff_s1_days', '25'],
        ['staff_s2_days', '30'], // Should be ignored because s2 is not in branch b1
      ],
    } as any

    const res = await savePayroll({}, fd)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((res as any).success).toBe(true)
    expect(insertedRecords.length).toBe(1)
    expect(insertedRecords[0].staffId).toBe('s1')
  })

  it('savePayroll handles transaction failure', async () => {
    mockDb._selectResult = []
    mockWithDbTransaction.mockRejectedValueOnce(new Error('db down'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => (k === 'month' ? '10' : k === 'year' ? '2023' : null),
      entries: () => [],
    } as any
    const res = await savePayroll({}, fd)
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  it('markAsPaid handles not found', async () => {
    mockDb._limitResult = []
    const res = await markAsPaid('p1')
    expect(res).toEqual({ error: 'Record not found' })
  })

  it('markAsPaid succeeds', async () => {
    mockDb._limitResult = [{ id: 'p1' }]
    const res = await markAsPaid('p1')
    expect(res).toEqual({ success: true })
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('markAsPaid handles db error', async () => {
    mockDb._limitResult = [{ id: 'p1' }]
    mockDb._updateBuilder.where.mockRejectedValueOnce(new Error('db down'))
    const res = await markAsPaid('p1')
    expect(res).toEqual({ error: 'Transaction failed' })
  })
})
