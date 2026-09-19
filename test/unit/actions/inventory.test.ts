import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addInventoryItem, adjustStock, updateInventoryItem, deleteInventoryItem } from '@/app/actions/inventory'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Inventory Actions', () => {
  beforeEach(() => { vi.clearAllMocks() 
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'owner', isGlobalOwner: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b1')
    vi.spyOn(auth, 'getSessionRole').mockResolvedValue('owner')
  })

  const mockFdInventory = (overrides: Record<string, string | null> = {}) => ({
    get: (k: string) => {
      if (overrides[k] !== undefined) return overrides[k];
      switch (k) {
        case 'name': return 'Valid Item';
        case 'unit': return 'kg';
        case 'quantity': return '10';
        case 'threshold': return '2';
        case 'branchId': return 'b1';
        default: return '';
      }
    }
  } as any as FormData);

  const mockFdAdjust = (overrides: Record<string, string | null> = {}) => ({
    get: (k: string) => {
      if (overrides[k] !== undefined) return overrides[k];
      switch (k) {
        case 'itemId': return 'inv_1';
        case 'branchId': return 'b1';
        case 'type': return 'increase';
        case 'amount': return '5';
        case 'reason': return 'Restock';
        default: return '';
      }
    }
  } as any as FormData);

  const mockFdUpdate = (overrides: Record<string, string | null> = {}) => ({
    get: (k: string) => {
      if (overrides[k] !== undefined) return overrides[k];
      switch (k) {
        case 'id': return 'inv_1';
        case 'name': return 'Valid Item';
        case 'unit': return 'kg';
        case 'threshold': return '2';
        case 'branchId': return 'b1';
        default: return '';
      }
    }
  } as any as FormData);

  // ─── addInventoryItem ──────────────────────────────────────────────────────
  it('addInventoryItem returns error on invalid input', async () => {
    const fd = { get: () => null } as any
    const res = await addInventoryItem({}, fd)
    expect(res?.error).toBeDefined()
  })

  it('addInventoryItem returns forbidden on branch access failure', async () => {
    vi.spyOn(auth, 'requireBranchAccess').mockRejectedValue(new Error('Forbidden'))
    const res = await addInventoryItem({}, mockFdInventory())
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('addInventoryItem returns already exists error', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ name: 'test', unit: 'kg', branchId: 'b1', isActive: true }])
      return true
    })
    const res = await addInventoryItem({}, mockFdInventory({ name: 'test', unit: 'kg' }))
    expect(res).toEqual({ error: 'An inventory item with this name and unit already exists in this branch' })
  })

  it('addInventoryItem creates item (zero quantity – no adjustment log)', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await addInventoryItem({}, mockFdInventory({ quantity: '0' }))
    expect(res).toEqual({ success: true })
  })

  it('addInventoryItem creates item with quantity > 0 (logs adjustment)', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await addInventoryItem({}, mockFdInventory({ quantity: '10' }))
    expect(res).toEqual({ success: true })
  })

  it('addInventoryItem handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const res = await addInventoryItem({}, mockFdInventory())
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── adjustStock ──────────────────────────────────────────────────────────
  it('adjustStock returns error on invalid input', async () => {
    const res = await adjustStock({}, { get: () => null } as any)
    expect(res?.error).toBeDefined()
  })

  it('adjustStock returns forbidden on branch access failure', async () => {
    vi.spyOn(auth, 'requireBranchAccess').mockRejectedValue(new Error('Forbidden'))
    const res = await adjustStock({}, mockFdAdjust())
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('adjustStock returns item not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await adjustStock({}, mockFdAdjust())
    expect(res).toEqual({ error: 'Item not found' })
  })

  it('adjustStock returns not enough stock', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'inv_1', currentQuantity: 1 }])
      return true
    })
    const res = await adjustStock({}, mockFdAdjust({ type: 'decrease' }))
    expect(res).toEqual({ error: 'Not enough stock to decrease' })
  })

  it('adjustStock handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'inv_1', currentQuantity: 100 }])
      return false
    })
    const res = await adjustStock({}, mockFdAdjust())
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  it('adjustStock decreases stock successfully', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'test', currentQuantity: 100 }])
      return true
    })
    const fd = {
      get: (k: string) => {
        if (k === 'itemId') return 'test'
        if (k === 'amount') return '10'
        if (k === 'type') return 'decrease'
        return 'test'
      }
    } as any
    const res = await adjustStock({}, fd)
    expect(res).toEqual({ success: true })
  })

  it('adjustStock increases stock successfully', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'test', currentQuantity: 5 }])
      return true
    })
    const fd = {
      get: (k: string) => {
        if (k === 'itemId') return 'test'
        if (k === 'amount') return '10'
        if (k === 'type') return 'increase'
        return 'test'
      }
    } as any
    const res = await adjustStock({}, fd)
    expect(res).toEqual({ success: true })
  })

  // ─── updateInventoryItem ──────────────────────────────────────────────────
  it('updateInventoryItem returns error on invalid input', async () => {
    const fd = { get: () => null } as any
    const res = await updateInventoryItem({}, fd)
    expect(res?.error).toBeDefined()
  })

  it('updateInventoryItem returns forbidden on branch access failure', async () => {
    vi.spyOn(auth, 'requireBranchAccess').mockRejectedValue(new Error('Forbidden'))
    const res = await updateInventoryItem({}, mockFdUpdate())
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('updateInventoryItem returns item not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await updateInventoryItem({}, mockFdUpdate())
    expect(res).toEqual({ error: 'Item not found' })
  })

  it('updateInventoryItem returns already exists error', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([
        { id: '1', name: 'Valid Item', unit: 'kg', branchId: 'b1', isActive: true },
        { id: 'inv_1', name: 'test', unit: 'test', branchId: 'b1', isActive: true }
      ])
      return true
    })
    const res = await updateInventoryItem({}, mockFdUpdate({ id: 'inv_1', name: 'Valid Item', unit: 'kg' }))
    expect(res).toEqual({ error: 'An inventory item with this name and unit already exists in this branch' })
  })

  it('updateInventoryItem handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'inv_1', name: 'Valid Item', unit: 'kg', branchId: 'b1', isActive: true }])
      return false
    })
    const res = await updateInventoryItem({}, mockFdUpdate())
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  it('updateInventoryItem succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'inv_1', name: 'Old', unit: 'litre', branchId: 'b1', isActive: true }])
      return true
    })
    const res = await updateInventoryItem({}, mockFdUpdate())
    expect(res).toEqual({ success: true })
  })

  // ─── deleteInventoryItem ──────────────────────────────────────────────────
  it('deleteInventoryItem returns item not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await deleteInventoryItem('1')
    expect(res).toEqual({ error: 'Item not found' })
  })

  it('deleteInventoryItem handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: '1', isActive: true }])
      return false
    })
    const res = await deleteInventoryItem('1')
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  it('deleteInventoryItem succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: '1', isActive: true }])
      return true
    })
    const res = await deleteInventoryItem('1')
    expect(res).toEqual({ success: true })
  })
})
