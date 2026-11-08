import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addVendor, addVendorBill, markVendorBillAsPaid } from '@/app/actions/vendors'
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

  return { mockDb: mock }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  vendors: {
    id: 'id',
    branchId: 'branchId',
    name: 'name',
    phone: 'phone',
    supplyType: 'supplyType',
    isActive: 'isActive',
    createdAt: 'createdAt',
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
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Vendor Actions', () => {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isGlobalOwner: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b1')
    vi.spyOn(auth, 'getSessionRole').mockResolvedValue('owner')
  })

  const mockFdVendor = (overrides: Record<string, string | null> = {}) => ({
    get: (k: string) => {
      if (overrides[k] !== undefined) return overrides[k]
      switch (k) {
        case 'name': return 'Valid Vendor'
        case 'phone': return '1234567890'
        case 'supplyType': return 'Food'
        case 'branchId': return 'b1'
        default: return ''
      }
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as FormData)

  const mockFdBill = (overrides: Record<string, string | null> = {}) => ({
    get: (k: string) => {
      if (overrides[k] !== undefined) return overrides[k]
      switch (k) {
        case 'vendorId': return 'ven_1'
        case 'vendorName': return 'Test Vendor'
        case 'amount': return '100'
        case 'categoryId': return 'cat_1'
        case 'date': return '2023-01-01'
        case 'branchId': return 'b1'
        case 'invoiceRef': return 'INV-001'
        default: return ''
      }
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as FormData)

  // ─── addVendor ────────────────────────────────────────────────────────────
  it('addVendor validates missing fields', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addVendor({}, { get: () => null } as any)
    expect(res?.error).toBeDefined()
  })

  it('addVendor succeeds and inserts into vendors', async () => {
    mockDb._limitResult = []
    const res = await addVendor({}, mockFdVendor())
    expect(res).toEqual({ success: true })
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('addVendor rejects duplicate vendor by name and branch', async () => {
    mockDb._limitResult = [{ id: 'ven_1', name: 'Valid Vendor' }]
    const res = await addVendor({}, mockFdVendor({ name: 'Valid Vendor', branchId: 'b1' }))
    expect(res).toEqual({ error: 'A vendor with this name already exists in this branch' })
  })

  it('addVendor handles db failure', async () => {
    mockDb._limitResult = []
    mockDb.values.mockRejectedValueOnce(new Error('db down'))
    const res = await addVendor({}, mockFdVendor())
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── addVendorBill ───────────────────────────────────────────────────────
  it('addVendorBill validates missing fields', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addVendorBill({}, { get: () => null } as any)
    expect(res?.error).toBeDefined()
  })

  it('addVendorBill succeeds with invoiceRef', async () => {
    let insertedVal: any = null
    mockDb.values.mockImplementationOnce((val: any) => {
      insertedVal = val
      return Promise.resolve([])
    })
    const res = await addVendorBill({}, mockFdBill({ categoryId: 'cat_id' }))
    expect(res).toEqual({ success: true })
    expect(mockDb.insert).toHaveBeenCalled()
    expect(insertedVal?.notes).toContain('Invoice: INV-001')
  })

  it('addVendorBill succeeds without invoiceRef', async () => {
    let insertedVal: any = null
    mockDb.values.mockImplementationOnce((val: any) => {
      insertedVal = val
      return Promise.resolve([])
    })
    const res = await addVendorBill({}, mockFdBill({ invoiceRef: null }))
    expect(res).toEqual({ success: true })
    expect(insertedVal?.notes).toBe('Vendor: Test Vendor')
  })

  it('addVendorBill handles db failure', async () => {
    mockDb.values.mockRejectedValueOnce(new Error('db down'))
    const res = await addVendorBill({}, mockFdBill())
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── markVendorBillAsPaid ────────────────────────────────────────────────
  it('markVendorBillAsPaid handles not found', async () => {
    mockDb._limitResult = []
    const res = await markVendorBillAsPaid('bill_99')
    expect(res).toEqual({ error: 'Bill not found' })
  })

  it('markVendorBillAsPaid succeeds', async () => {
    mockDb._limitResult = [{ id: 'bill_99', isPaid: false, branchId: 'b1' }]
    const res = await markVendorBillAsPaid('bill_99')
    expect(res).toEqual({ success: true })
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('markVendorBillAsPaid handles db failure', async () => {
    mockDb._limitResult = [{ id: 'bill_99', isPaid: false, branchId: 'b1' }]
    mockDb._updateBuilder.where.mockRejectedValueOnce(new Error('db down'))
    const res = await markVendorBillAsPaid('bill_99')
    expect(res).toEqual({ error: 'Transaction failed' })
  })
})
