import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateExpense } from '@/app/actions/expenses'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAction: vi.fn() }))
vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn()
}))

describe('Expenses Actions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'Admin', branchId: 'b1' } as any)
  })

  it('updateExpense validates auth (no session)', async () => {
    vi.mocked(auth.getSession).mockResolvedValueOnce(null as any)
    const res = await updateExpense('e1', { amount: 200 })
    expect(res).toEqual({ error: 'Unauthorized' })
  })

  it('updateExpense validates role (non-admin)', async () => {
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'Staff', branchId: 'b1' } as any)
    const res = await updateExpense('e1', { amount: 200 })
    expect(res).toEqual({ error: 'Only administrators can edit ledger expenses.' })
  })

  it('updateExpense returns not found when expense missing', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await updateExpense('e1', { amount: 200 })
    expect(res).toEqual({ error: 'Expense not found.' })
  })

  it('updateExpense succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'e1', amount: 100, branchId: 'b1', notes: 'test' }])
      return true
    })
    const res = await updateExpense('e1', { amount: 200 })
    expect(res).toEqual({ success: true })
  })

  it('updateExpense handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'e1', amount: 100, branchId: 'b1', notes: 'test' }])
      return false
    })
    const res = await updateExpense('e1', { amount: 200 })
    expect(res).toEqual({ error: 'Transaction failed' })
  })
})
