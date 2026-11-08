import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateExpense, deleteExpense } from '@/app/actions/expenses'
import * as auth from '@/app/actions/auth'

const { mockDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryBuilder: any = {
    where: vi.fn(),
    limit: vi.fn(),
  }
  queryBuilder.where.mockReturnValue(queryBuilder)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateBuilder: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  }
  updateBuilder.set.mockReturnValue(updateBuilder)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deleteBuilder: any = {
    where: vi.fn().mockResolvedValue([]),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    _limitResult: [],
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnValue(queryBuilder),
    update: vi.fn().mockReturnValue(updateBuilder),
    delete: vi.fn().mockReturnValue(deleteBuilder),
    _queryBuilder: queryBuilder,
    _updateBuilder: updateBuilder,
    _deleteBuilder: deleteBuilder,
  }

  queryBuilder.limit.mockImplementation(() => Promise.resolve(mock._limitResult))

  return { mockDb: mock }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
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
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAction: vi.fn().mockResolvedValue(true) }))
vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn(),
}))

describe('Expenses Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb._limitResult = []
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnValue(mockDb._queryBuilder)
    mockDb._queryBuilder.where.mockReturnValue(mockDb._queryBuilder)
    mockDb._queryBuilder.limit.mockImplementation(() => Promise.resolve(mockDb._limitResult))
    mockDb.update.mockReturnValue(mockDb._updateBuilder)
    mockDb._updateBuilder.set.mockReturnValue(mockDb._updateBuilder)
    mockDb._updateBuilder.where.mockResolvedValue([])
    mockDb.delete.mockReturnValue(mockDb._deleteBuilder)
    mockDb._deleteBuilder.where.mockResolvedValue([])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'admin', isGlobalAdmin: true, branchId: 'b1' } as any)
  })

  // ─── updateExpense ────────────────────────────────────────────────────────
  it('updateExpense validates auth (no session)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce(null as any)
    const res = await updateExpense('e1', { amount: 200 })
    expect(res).toEqual({ error: 'Unauthorized' })
  })

  it('updateExpense validates role (non-global-admin)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager', isGlobalAdmin: false } as any)
    const res = await updateExpense('exp1', {})
    expect(res).toEqual({ error: 'Only admin and owner can edit ledger expenses.' })
  })

  it('updateExpense returns not found when expense missing', async () => {
    mockDb._limitResult = []
    const res = await updateExpense('e1', { amount: 200 })
    expect(res).toEqual({ error: 'Expense not found.' })
  })

  it('updateExpense blocks branch change (Req 6.6)', async () => {
    mockDb._limitResult = [{ id: 'e1', amount: 100, branchId: 'b1', notes: 'test', date: '2023-10-01', categoryId: 'c1' }]
    const res = await updateExpense('e1', { amount: 200, branchId: 'b2' })
    expect(res).toEqual({ error: 'Cannot change the branch of an existing expense.' })
  })

  it('updateExpense succeeds', async () => {
    mockDb._limitResult = [{ id: 'e1', amount: 100, branchId: 'b1', notes: 'test', date: '2023-10-01', categoryId: 'c1' }]
    const res = await updateExpense('e1', { amount: 200 })
    expect(res).toEqual({ success: true })
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('updateExpense handles db failure', async () => {
    mockDb._limitResult = [{ id: 'e1', amount: 100, branchId: 'b1', notes: 'test', date: '2023-10-01', categoryId: 'c1' }]
    mockDb._updateBuilder.where.mockRejectedValueOnce(new Error('db down'))
    const res = await updateExpense('e1', { amount: 200 })
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── deleteExpense ────────────────────────────────────────────────────────
  it('deleteExpense validates auth (no session)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce(null as any)
    const res = await deleteExpense('e1')
    expect(res).toEqual({ error: 'Unauthorized' })
  })

  it('deleteExpense validates role (non-global-admin)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager', isGlobalAdmin: false } as any)
    const res = await deleteExpense('e1')
    expect(res).toEqual({ error: 'Unauthorized' })
  })

  it('deleteExpense returns not found when expense missing', async () => {
    mockDb._limitResult = []
    const res = await deleteExpense('e1')
    expect(res).toEqual({ error: 'Not found' })
  })

  it('deleteExpense succeeds with hard delete', async () => {
    mockDb._limitResult = [{ id: 'e1', amount: 100 }]
    const res = await deleteExpense('e1')
    expect(res).toEqual({ success: true })
    expect(mockDb.delete).toHaveBeenCalled()
  })

  it('deleteExpense handles db failure', async () => {
    mockDb._limitResult = [{ id: 'e1', amount: 100 }]
    mockDb._deleteBuilder.where.mockRejectedValueOnce(new Error('db down'))
    const res = await deleteExpense('e1')
    expect(res).toEqual({ error: 'Failed to delete' })
  })
})
