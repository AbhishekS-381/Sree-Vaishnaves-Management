import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addInventoryItem, adjustStock } from '@/app/actions/inventory'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Inventory Actions', () => {
  beforeEach(() => { vi.resetAllMocks() 
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'owner', isGlobalOwner: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b1')
    vi.spyOn(auth, 'getSessionRole').mockResolvedValue('owner')
  })

  // ─── addInventoryItem ──────────────────────────────────────────────────────
  it('addInventoryItem returns error on invalid input', async () => {
    const fd = { get: () => null } as any
    const res = await addInventoryItem({}, fd)
    expect(res).toEqual({ error: 'Invalid input' })
  })

  it('addInventoryItem creates item (zero quantity – no adjustment log)', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const fd = {
      get: (k: string) => {
        if (k === 'quantity' || k === 'threshold') return '0'
        return 'test'
      }
    } as any
    const res = await addInventoryItem({}, fd)
    expect(res).toEqual({ success: true })
  })

  it('addInventoryItem creates item with quantity > 0 (logs adjustment)', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const fd = {
      get: (k: string) => {
        if (k === 'quantity') return '10'
        if (k === 'threshold') return '2'
        return 'test'
      }
    } as any
    const res = await addInventoryItem({}, fd)
    expect(res).toEqual({ success: true })
  })

  it('addInventoryItem handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const fd = {
      get: (k: string) => {
        if (k === 'quantity' || k === 'threshold') return '5'
        return 'test'
      }
    } as any
    const res = await addInventoryItem({}, fd)
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── adjustStock ──────────────────────────────────────────────────────────
  it('adjustStock returns error on invalid input', async () => {
    const fd = { get: () => null } as any
    const res = await adjustStock({}, fd)
    expect(res).toEqual({ error: 'Invalid adjustments' })
  })

  it('adjustStock returns item not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const fd = {
      get: (k: string) => {
        if (k === 'amount') return '5'
        return 'test'
      }
    } as any
    const res = await adjustStock({}, fd)
    expect(res).toEqual({ error: 'Item not found' })
  })

  it('adjustStock returns not enough stock', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'test', currentQuantity: 1 }])
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
    expect(res).toEqual({ error: 'Not enough stock to decrease' })
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
})
