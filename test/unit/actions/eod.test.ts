import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveEODEntry, getEODByDate, getExpensesByDate } from '@/app/actions/eod'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn().mockResolvedValue([]),
  writeJSON: vi.fn().mockResolvedValue(true),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import * as auth from '@/app/actions/auth'

describe('EOD Actions', () => {
  beforeEach(() => { 
    vi.clearAllMocks() 
    vi.spyOn(auth, 'getSession').mockResolvedValue({ userId: 'test-user', role: 'admin', isGlobalAdmin: true, isRootAdmin: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockImplementation(async (b) => (b as string) || 'b1')
  })

  it('getEODByDate returns single match', async () => {
    vi.mocked(db.readJSON).mockResolvedValue([
      { date: '2023-10-01', branchId: 'b1' },
      { date: '2023-10-02', branchId: 'b1' },
      { date: '2023-10-01', branchId: 'b2' }
    ])
    const res = await getEODByDate('2023-10-01', 'b1')
    expect(res).toHaveProperty('date', '2023-10-01')
  })

  it('getExpensesByDate filters correctly', async () => {
    vi.mocked(db.readJSON).mockResolvedValue([
      { date: '2023-10-01', branchId: 'b1' },
      { date: '2023-10-01', branchId: 'b2' }
    ])
    const res = await getExpensesByDate('2023-10-01', 'b1')
    expect(res.length).toBe(1)
  })

  it('saveEODEntry returns error if locked', async () => {
    vi.spyOn(auth, 'getSession').mockResolvedValueOnce({ userId: 'test-user', role: 'owner', isGlobalOwner: false, branchId: 'b1' } as any)
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ date: '2023-10-01', branchId: 'b1', status: 'locked' }])
      return true
    })
    const res = await saveEODEntry(
      { date: '2023-10-01', branchId: 'b1', income: { dineInCash: 0, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 }, openingFloat: 0, actualClosingFloat: 0, notes: '' },
      []
    )
    expect(res).toEqual({ error: 'EOD for this date is already locked.' })
  })

  it('saveEODEntry creates new entry', async () => {
    let callCount = 0
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      callCount++
      await cb([])
      return true
    })
    const res = await saveEODEntry(
      { date: '2023-10-01', branchId: 'b1', income: { dineInCash: 100, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 }, openingFloat: 50, actualClosingFloat: 60, notes: 'Good day' },
      [{ amount: 20, category: 'Food', branchId: 'b1', date: '2023-10-01', notes: 'lunch' }] as any
    )
    expect(res).toEqual({ success: true })
  })

  it('saveEODEntry updates existing draft', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ date: '2023-10-01', branchId: 'b1', status: 'draft' }])
      return true
    })
    const res = await saveEODEntry(
      { date: '2023-10-01', branchId: 'b1', income: { dineInCash: 200, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 }, openingFloat: 0, actualClosingFloat: 0, notes: '' },
      []
    )
    expect(res).toEqual({ success: true })
  })

  it('saveEODEntry handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const res = await saveEODEntry(
      { date: '2023-10-01', branchId: 'b1', income: { dineInCash: 0, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 }, openingFloat: 0, actualClosingFloat: 0, notes: '' },
      []
    )
    expect(res).toEqual({ error: 'Transaction failed' })
  })
})
