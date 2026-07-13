import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as actions from '@/app/actions/menu'
import * as db from '@/lib/db'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  readJSON: vi.fn().mockResolvedValue([]),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAction: vi.fn() }))
vi.mock('@/app/actions/auth', () => ({ 
  getSession: vi.fn().mockResolvedValue({ role: 'owner', branchId: 'b1', isGlobalAdmin: true }), 
  getSessionRole: vi.fn().mockResolvedValue('owner'), 
  requireBranchAccess: vi.fn().mockImplementation(async (b) => b || 'b1') 
}))

describe('menu Actions', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const getValidFormData = () => {
    return {
      get: (k: string) => {
        if (k === 'amount' || k === 'price' || k === 'count' || k === 'requiredCount' || k === 'monthlySalary') return '10'
        if (k === 'isPaid' || k === 'currentState' || k === 'currentlyActive') return 'on'
        if (k === 'username') return 'new_user'
        if (k === 'branchId') return 'b1'
        if (k === 'name' || k === 'categoryId') return 'test_value'
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
      expect(res.error).toBeDefined()
    })

    it('succeeds with valid input and generates UUID', async () => {
      const fd = getValidFormData()
      let savedList: any[] = []
      vi.mocked(db.withTransaction).mockImplementation(async (f, cb) => { 
        savedList = await cb([]); 
        return true 
      })
      vi.mocked(db.readJSON).mockResolvedValue([])
      const res = await (actions as any).addMenuItem({}, fd)
      expect(res.success).toBe(true)
      expect(savedList.length).toBe(1)
      expect(savedList[0].id).toMatch(/^mn_12345678-1234-1234-1234-123456789012$/)
      expect(savedList[0].category).toBeUndefined()
    })

    it('rejects duplicate menu item', async () => {
      const fd = getValidFormData()
      vi.mocked(db.withTransaction).mockImplementation(async (f, cb) => {
        await cb([{ id: 'mn_old', name: 'test_value', categoryId: 'test_value' }])
        return true
      })
      const res = await (actions as any).addMenuItem({}, fd)
      expect(res.error).toBe('A menu item with this name already exists in this category')
    })

    it('blocks non-admin from adding menu item', async () => {
      const { getSession } = await import('@/app/actions/auth')
      vi.mocked(getSession).mockResolvedValueOnce({ role: 'manager', isGlobalAdmin: false, branchId: 'b1' } as any)
      const fd = getValidFormData()
      const res = await (actions as any).addMenuItem({}, fd)
      expect(res.error).toBe('Forbidden: Admin or Owner access required')
    })
  })

  describe('toggleMenuItemStatus', () => {
    it('succeeds with valid id', async () => {
      vi.mocked(db.withTransaction).mockImplementation(async (f, cb) => { await cb([{id: 'test_value'}]); return true })
      vi.mocked(db.readJSON).mockResolvedValue([{id: 'test_value'}])
      const res = await (actions as any).toggleMenuItemStatus('b1', 'test_value', true)
    })

    it('blocks non-admin from toggling other branch item', async () => {
      const { getSession } = await import('@/app/actions/auth')
      vi.mocked(getSession).mockResolvedValueOnce({ role: 'manager', isGlobalAdmin: false, branchId: 'b1' } as any)
      const res = await (actions as any).toggleMenuItemStatus('b2', 'test_value', true)
      expect(res.error).toBe('Forbidden')
    })
  })

  describe('deleteMenuItem', () => {
    it('succeeds with valid id for admin', async () => {
      vi.mocked(db.withTransaction).mockImplementation(async (f, cb) => {
        await cb([{id: 'test_value', menuItemId: 'test_value'}]);
        return true
      })
      await (actions as any).deleteMenuItem('test_value')
      expect(vi.mocked(db.withTransaction)).toHaveBeenCalledTimes(2)
    })

    it('blocks non-admin from deleting item', async () => {
      const { getSession } = await import('@/app/actions/auth')
      vi.mocked(getSession).mockResolvedValueOnce({ role: 'manager', isGlobalAdmin: false, branchId: 'b1' } as any)
      const res = await (actions as any).deleteMenuItem('test_value')
      expect(res.error).toBe('Forbidden: Admin or Owner access required')
    })
  })

})
