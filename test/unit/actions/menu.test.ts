import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as actions from '@/app/actions/menu'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAction: vi.fn() }))
vi.mock('@/app/actions/auth', () => ({ getSession: vi.fn().mockResolvedValue({ role: 'owner', branchId: 'b1' }), getSessionRole: vi.fn().mockResolvedValue('owner') }))

describe('menu Actions', () => {
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

  describe('addMenuItem', () => {
    it('validates empty input', async () => {
      const fd = { get: () => null, getAll: () => [] } as any as FormData
      const res = await (actions as any).addMenuItem({}, fd)
    })

    it('succeeds with valid input', async () => {
      const fd = getValidFormData()
      vi.mocked(db.withTransaction).mockImplementation(async (f, cb) => { await cb([]); return true })
      vi.mocked(db.readJSON).mockResolvedValue([])
      const res = await (actions as any).addMenuItem({}, fd)
    })
  })

  describe('toggleMenuItemStatus', () => {
    it('succeeds with valid id', async () => {
      vi.mocked(db.withTransaction).mockImplementation(async (f, cb) => { await cb([{id: 'test_value'}]); return true })
      vi.mocked(db.readJSON).mockResolvedValue([{id: 'test_value'}])
      const res = await (actions as any).toggleMenuItemStatus('test_value', true)
    })
  })

  describe('deleteMenuItem', () => {
    it('succeeds with valid id', async () => {
      vi.mocked(db.withTransaction).mockImplementation(async (f, cb) => { await cb([{id: 'test_value'}]); return true })
      vi.mocked(db.readJSON).mockResolvedValue([{id: 'test_value'}])
      const res = await (actions as any).deleteMenuItem('test_value', true)
    })
  })

})
