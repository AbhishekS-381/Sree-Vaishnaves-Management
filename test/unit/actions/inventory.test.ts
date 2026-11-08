import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addInventoryItem, adjustStock, updateInventoryItem, deleteInventoryItem } from '@/app/actions/inventory'
import * as auth from '@/app/actions/auth'

const { mockDb, mockWithDbTransaction } = vi.hoisted(() => {
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
  const mock: any = {
    _limitResult: [],
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnValue(queryBuilder),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnValue(updateBuilder),
    _queryBuilder: queryBuilder,
    _updateBuilder: updateBuilder,
  }

  queryBuilder.limit.mockImplementation(() => Promise.resolve(mock._limitResult))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockWithTx = vi.fn().mockImplementation(async (cb: any) => cb(mock))

  return { mockDb: mock, mockWithDbTransaction: mockWithTx }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  inventory: {
    id: 'id',
    branchId: 'branchId',
    name: 'name',
    unit: 'unit',
    currentQuantity: 'currentQuantity',
    threshold: 'threshold',
    updatedAt: 'updatedAt',
    isActive: 'isActive',
    deletedAt: 'deletedAt',
  },
  stockAdjustments: {
    id: 'id',
    itemId: 'itemId',
    branchId: 'branchId',
    type: 'type',
    amount: 'amount',
    reason: 'reason',
    date: 'date',
  },
  withDbTransaction: mockWithDbTransaction,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Inventory Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb._limitResult = []
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnValue(mockDb._queryBuilder)
    mockDb._queryBuilder.where.mockReturnValue(mockDb._queryBuilder)
    mockDb._queryBuilder.limit.mockImplementation(() => Promise.resolve(mockDb._limitResult))
    mockDb.insert.mockReturnThis()
    mockDb.values.mockResolvedValue([])
    mockDb.update.mockReturnValue(mockDb._updateBuilder)
    mockDb._updateBuilder.set.mockReturnValue(mockDb._updateBuilder)
    mockDb._updateBuilder.where.mockResolvedValue([])
    mockWithDbTransaction.mockImplementation(async (cb: any) => cb(mockDb))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'owner', isGlobalOwner: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b1')
    vi.spyOn(auth, 'getSessionRole').mockResolvedValue('owner')
  })

  const mockFdInventory = (overrides: Record<string, string | null> = {}) => ({
    get: (k: string) => {
      if (overrides[k] !== undefined) return overrides[k]
      switch (k) {
        case 'name': return 'Valid Item'
        case 'unit': return 'kg'
        case 'quantity': return '10'
        case 'threshold': return '2'
        case 'branchId': return 'b1'
        default: return ''
      }
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as FormData)

  const mockFdAdjust = (overrides: Record<string, string | null> = {}) => ({
    get: (k: string) => {
      if (overrides[k] !== undefined) return overrides[k]
      switch (k) {
        case 'itemId': return 'inv_1'
        case 'branchId': return 'b1'
        case 'type': return 'increase'
        case 'amount': return '5'
        case 'reason': return 'Restock'
        default: return ''
      }
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as FormData)

  const mockFdUpdate = (overrides: Record<string, string | null> = {}) => ({
    get: (k: string) => {
      if (overrides[k] !== undefined) return overrides[k]
      switch (k) {
        case 'id': return 'inv_1'
        case 'name': return 'Valid Item'
        case 'unit': return 'kg'
        case 'threshold': return '2'
        case 'branchId': return 'b1'
        default: return ''
      }
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as FormData)

  // ─── addInventoryItem ──────────────────────────────────────────────────────
  it('addInventoryItem returns error on invalid input', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    mockDb._limitResult = [{ id: 'inv_1', name: 'test', unit: 'kg', branchId: 'b1' }]
    const res = await addInventoryItem({}, mockFdInventory({ name: 'test', unit: 'kg' }))
    expect(res).toEqual({ error: 'An inventory item with this name and unit already exists in this branch' })
  })

  it('addInventoryItem creates item (zero quantity – no adjustment log)', async () => {
    mockDb._limitResult = []
    const res = await addInventoryItem({}, mockFdInventory({ quantity: '0' }))
    expect(res).toEqual({ success: true })
    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockWithDbTransaction).not.toHaveBeenCalled()
  })

  it('addInventoryItem creates item with quantity > 0 (wrapped in transaction)', async () => {
    mockDb._limitResult = []
    const res = await addInventoryItem({}, mockFdInventory({ quantity: '10' }))
    expect(res).toEqual({ success: true })
    expect(mockWithDbTransaction).toHaveBeenCalled()
  })

  it('addInventoryItem handles transaction failure', async () => {
    mockDb._limitResult = []
    mockWithDbTransaction.mockRejectedValueOnce(new Error('db down'))
    const res = await addInventoryItem({}, mockFdInventory({ quantity: '10' }))
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── adjustStock ──────────────────────────────────────────────────────────
  it('adjustStock returns error on invalid input', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await adjustStock({}, { get: () => null } as any)
    expect(res?.error).toBeDefined()
  })

  it('adjustStock returns forbidden on branch access failure', async () => {
    vi.spyOn(auth, 'requireBranchAccess').mockRejectedValue(new Error('Forbidden'))
    const res = await adjustStock({}, mockFdAdjust())
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('adjustStock returns item not found', async () => {
    mockDb._limitResult = []
    const res = await adjustStock({}, mockFdAdjust())
    expect(res).toEqual({ error: 'Item not found' })
  })

  it('adjustStock returns not enough stock', async () => {
    mockDb._limitResult = [{ id: 'inv_1', currentQuantity: 1 }]
    const res = await adjustStock({}, mockFdAdjust({ type: 'decrease', amount: '5' }))
    expect(res).toEqual({ error: 'Not enough stock to decrease' })
  })

  it('adjustStock handles transaction failure', async () => {
    mockDb._limitResult = [{ id: 'inv_1', currentQuantity: 100 }]
    mockWithDbTransaction.mockRejectedValueOnce(new Error('db down'))
    const res = await adjustStock({}, mockFdAdjust())
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  it('adjustStock decreases stock successfully', async () => {
    mockDb._limitResult = [{ id: 'test', currentQuantity: 100 }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => {
        if (k === 'itemId') return 'test'
        if (k === 'branchId') return 'b1'
        if (k === 'amount') return '10'
        if (k === 'type') return 'decrease'
        if (k === 'reason') return 'Used in kitchen'
        return ''
      },
    } as any
    const res = await adjustStock({}, fd)
    expect(res).toEqual({ success: true })
    expect(mockWithDbTransaction).toHaveBeenCalled()
  })

  it('adjustStock increases stock successfully', async () => {
    mockDb._limitResult = [{ id: 'test', currentQuantity: 5 }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => {
        if (k === 'itemId') return 'test'
        if (k === 'branchId') return 'b1'
        if (k === 'amount') return '10'
        if (k === 'type') return 'increase'
        if (k === 'reason') return 'Restock shipment'
        return ''
      },
    } as any
    const res = await adjustStock({}, fd)
    expect(res).toEqual({ success: true })
    expect(mockWithDbTransaction).toHaveBeenCalled()
  })

  // ─── updateInventoryItem ──────────────────────────────────────────────────
  it('updateInventoryItem returns error on invalid input', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    mockDb._limitResult = []
    const res = await updateInventoryItem({}, mockFdUpdate())
    expect(res).toEqual({ error: 'Item not found' })
  })

  it('updateInventoryItem returns already exists error', async () => {
    mockDb._queryBuilder.limit
      .mockResolvedValueOnce([{ id: 'inv_1', name: 'Old', unit: 'kg' }]) // target found
      .mockResolvedValueOnce([{ id: 'other_id' }]) // duplicate exists
    const res = await updateInventoryItem({}, mockFdUpdate({ id: 'inv_1', name: 'Valid Item', unit: 'kg' }))
    expect(res).toEqual({ error: 'An inventory item with this name and unit already exists in this branch' })
  })

  it('updateInventoryItem handles db failure', async () => {
    mockDb._queryBuilder.limit
      .mockResolvedValueOnce([{ id: 'inv_1', name: 'Valid Item', unit: 'kg' }])
      .mockResolvedValueOnce([])
    mockDb._updateBuilder.where.mockRejectedValueOnce(new Error('db down'))
    const res = await updateInventoryItem({}, mockFdUpdate())
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  it('updateInventoryItem succeeds', async () => {
    mockDb._queryBuilder.limit
      .mockResolvedValueOnce([{ id: 'inv_1', name: 'Old', unit: 'litre' }])
      .mockResolvedValueOnce([])
    const res = await updateInventoryItem({}, mockFdUpdate())
    expect(res).toEqual({ success: true })
    expect(mockDb.update).toHaveBeenCalled()
  })

  // ─── deleteInventoryItem ──────────────────────────────────────────────────
  it('deleteInventoryItem returns item not found', async () => {
    mockDb._limitResult = []
    const res = await deleteInventoryItem('1')
    expect(res).toEqual({ error: 'Item not found' })
  })

  it('deleteInventoryItem handles db failure', async () => {
    mockDb._limitResult = [{ id: '1', isActive: true }]
    mockDb._updateBuilder.where.mockRejectedValueOnce(new Error('db down'))
    const res = await deleteInventoryItem('1')
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  it('deleteInventoryItem succeeds', async () => {
    mockDb._limitResult = [{ id: '1', isActive: true }]
    const res = await deleteInventoryItem('1')
    expect(res).toEqual({ success: true })
    expect(mockDb.update).toHaveBeenCalled()
  })
})
