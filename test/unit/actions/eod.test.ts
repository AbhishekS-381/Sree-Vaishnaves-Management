import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveEODEntry, getEODByDate, getExpensesByDate } from '@/app/actions/eod'
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
  const deleteBuilder: any = {
    where: vi.fn().mockResolvedValue([]),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    _selectResult: [],
    _limitResult: [],
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnValue(queryBuilder),
    insert: vi.fn().mockReturnValue(insertBuilder),
    delete: vi.fn().mockReturnValue(deleteBuilder),
    _queryBuilder: queryBuilder,
    _insertBuilder: insertBuilder,
    _deleteBuilder: deleteBuilder,
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
  eod: {
    id: 'id',
    branchId: 'branchId',
    date: 'date',
    income: 'income',
    openingFloat: 'openingFloat',
    actualClosingFloat: 'actualClosingFloat',
    notes: 'notes',
    status: 'status',
    billing: 'billing',
    ops: 'ops',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  expenses: {
    id: 'id',
    branchId: 'branchId',
    amount: 'amount',
    categoryId: 'categoryId',
    source: 'source',
    date: 'date',
    notes: 'notes',
    isPaid: 'isPaid',
    createdAt: 'createdAt',
  },
  withDbTransaction: mockWithDbTransaction,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAction: vi.fn().mockResolvedValue(true) }))

describe('EOD Actions', () => {
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
    mockDb.delete.mockReturnValue(mockDb._deleteBuilder)
    mockDb._deleteBuilder.where.mockResolvedValue([])
    mockWithDbTransaction.mockImplementation(async (cb: any) => cb(mockDb))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(auth, 'getSession').mockResolvedValue({ userId: 'test-user', role: 'admin', isGlobalAdmin: true, isRootAdmin: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockImplementation(async (b) => (b as string) || 'b1')
  })

  it('getEODByDate returns single match', async () => {
    mockDb._limitResult = [
      {
        id: 'eod_1',
        date: '2023-10-01',
        branchId: 'b1',
        income: { dineInCash: 100, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 },
        status: 'submitted',
        createdAt: new Date('2023-10-01T10:00:00Z'),
        updatedAt: new Date('2023-10-01T10:00:00Z'),
      },
    ]
    const res = await getEODByDate('2023-10-01', 'b1')
    expect(res).toHaveProperty('date', '2023-10-01')
    expect(res?.id).toBe('eod_1')
  })

  it('getExpensesByDate filters correctly', async () => {
    mockDb._selectResult = [
      {
        id: 'exp_1',
        date: '2023-10-01',
        branchId: 'b1',
        amount: 50,
        categoryId: 'c1',
        source: 'eod',
        createdAt: new Date('2023-10-01T10:00:00Z'),
      },
    ]
    const res = await getExpensesByDate('2023-10-01', 'b1')
    expect(res.length).toBe(1)
    expect(res[0].id).toBe('exp_1')
  })

  it('saveEODEntry returns error if locked', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(auth, 'getSession').mockResolvedValueOnce({ userId: 'test-user', role: 'manager', isGlobalAdmin: false, isGlobalOwner: false, branchId: 'b1' } as any)
    mockDb._limitResult = [
      {
        id: 'eod_1',
        date: '2023-10-01',
        branchId: 'b1',
        status: 'locked',
        createdAt: new Date('2023-10-01T10:00:00Z'),
      },
    ]
    const res = await saveEODEntry(
      { date: '2023-10-01', branchId: 'b1', income: { dineInCash: 100, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 }, openingFloat: 0, actualClosingFloat: 0, notes: '' },
      []
    )
    expect(res).toEqual({ error: 'EOD for this date is already locked.' })
  })

  it('saveEODEntry creates new entry with atomic transaction', async () => {
    mockDb._limitResult = [] // no existing
    const res = await saveEODEntry(
      { date: '2023-10-01', branchId: 'b1', income: { dineInCash: 100, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 }, openingFloat: 50, actualClosingFloat: 60, notes: 'Good day' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [{ amount: 20, categoryId: 'Food', branchId: 'b1', date: '2023-10-01', notes: 'lunch' }] as any
    )
    expect(res).toEqual({ success: true })
    expect(mockWithDbTransaction).toHaveBeenCalled()
    expect(mockDb._insertBuilder.onConflictDoUpdate).toHaveBeenCalled()
    expect(mockDb._deleteBuilder.where).toHaveBeenCalled()
  })

  it('saveEODEntry batches multiple expenses into a single insert statement', async () => {
    mockDb._limitResult = []
    const expensesMock = [
      { amount: 50, categoryId: 'Cat1', branchId: 'b1', date: '2023-10-01', notes: 'exp 1' },
      { amount: 75, categoryId: 'Cat2', branchId: 'b1', date: '2023-10-01', notes: 'exp 2' },
      { amount: 120, categoryId: 'Cat3', branchId: 'b1', date: '2023-10-01', notes: 'exp 3' },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await saveEODEntry(
      { date: '2023-10-01', branchId: 'b1', income: { dineInCash: 100, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 }, openingFloat: 0, actualClosingFloat: 0, notes: '' },
      expensesMock as any
    )
    expect(res).toEqual({ success: true })
    // Called once for EOD upsert, once for batched expenses insert
    expect(mockDb.insert).toHaveBeenCalledTimes(2)
  })

  it('saveEODEntry updates existing draft', async () => {
    mockDb._limitResult = [
      {
        id: 'eod_1',
        date: '2023-10-01',
        branchId: 'b1',
        status: 'draft',
        createdAt: new Date(),
      },
    ]
    const res = await saveEODEntry(
      { date: '2023-10-01', branchId: 'b1', income: { dineInCash: 200, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 }, openingFloat: 0, actualClosingFloat: 0, notes: '' },
      []
    )
    expect(res).toEqual({ success: true })
  })

  it('saveEODEntry handles transaction failure', async () => {
    mockDb._limitResult = []
    mockWithDbTransaction.mockRejectedValueOnce(new Error('db down'))
    const res = await saveEODEntry(
      { date: '2023-10-01', branchId: 'b1', income: { dineInCash: 100, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 }, openingFloat: 0, actualClosingFloat: 0, notes: '' },
      []
    )
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  it('saveEODEntry returns error if total income is 0 and zeroRevenueConfirmed is false', async () => {
    const res = await saveEODEntry(
      { date: '2023-10-01', branchId: 'b1', income: { dineInCash: 0, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 }, openingFloat: 0, actualClosingFloat: 0, notes: '', ops: { staffOnDuty: 0, powerCutHours: 0, unusualEvent: '', kitchenIssue: false, zeroRevenueConfirmed: false } },
      []
    )
    expect(res).toEqual({ error: 'ZERO_REVENUE_UNCONFIRMED' })
  })

  it('saveEODEntry succeeds if total income is 0 and zeroRevenueConfirmed is true', async () => {
    mockDb._limitResult = []
    const res = await saveEODEntry(
      { date: '2023-10-01', branchId: 'b1', income: { dineInCash: 0, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 }, openingFloat: 0, actualClosingFloat: 0, notes: '', ops: { staffOnDuty: 0, powerCutHours: 0, unusualEvent: '', kitchenIssue: false, zeroRevenueConfirmed: true } },
      []
    )
    expect(res).toEqual({ success: true })
  })

  it('saveEODEntry returns error if negative billing amount provided', async () => {
    const res = await saveEODEntry(
      { date: '2023-10-01', branchId: 'b1', income: { dineInCash: 100, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 }, openingFloat: 0, actualClosingFloat: 0, notes: '', billing: { totalBillAmount: -100, billCount: 0, dineInCovers: 0, takeawayOrders: 0, cashCollectedAsBilled: 0, upiCollectedAsBilled: 0, voids: 0, discounts: 0, gstCollected: 0 } },
      []
    )
    expect(res?.error).toBeDefined()
  })

  it('saveEODEntry blocks future dates', async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 2)
    const futureDateStr = futureDate.toISOString().split('T')[0]
    const res = await saveEODEntry(
      { date: futureDateStr, branchId: 'b1', income: { dineInCash: 100, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 }, openingFloat: 0, actualClosingFloat: 0, notes: '' },
      []
    )
    expect(res).toEqual({ error: 'EOD entry cannot be submitted for a future date' })
  })
})
