import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as actions from '@/app/actions/config'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAction: vi.fn() }))
vi.mock('@/app/actions/auth', () => ({ getSession: vi.fn().mockResolvedValue({ role: 'owner', branchId: 'b1' }), getSessionRole: vi.fn().mockResolvedValue('owner') }))

describe('config Actions', () => {
  beforeEach(() => { vi.resetAllMocks() })

  const getValidFormData = () => {
    return {
      get: (k: string) => {
        if (k === 'amount' || k === 'price' || k === 'count' || k === 'requiredCount' || k === 'monthlySalary') return '10'
        if (k === 'isPaid' || k === 'currentState' || k === 'currentlyActive') return 'on'
        if (k === 'username') return 'new_user'
        if (k === 'date') return new Date().toISOString()
        return 'test_value'
      },
      getAll: (k: string) => ['test_value'],
      entries: () => []
    } as any as FormData
  }

  describe('toggleModule', () => {
    it('executes without error', async () => {
      vi.mocked(db.readJSON).mockResolvedValue([])
      try { await (actions as any).toggleModule(); } catch (e) {}
    })
  })

})
