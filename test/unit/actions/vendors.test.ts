import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addVendor, addVendorBill, markVendorBillAsPaid } from '@/app/actions/vendors'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'

vi.mock('@/lib/db', () => ({
  withTransaction: vi.fn(),
  DB_FILES: new Proxy({}, { get: () => 'mock.json' })
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('Vendor Actions', () => {
  beforeEach(() => { 
    vi.clearAllMocks() 
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isGlobalOwner: true, branchId: 'b1' } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b1')
    vi.spyOn(auth, 'getSessionRole').mockResolvedValue('owner')
  })

  // ─── addVendor ────────────────────────────────────────────────────────────
  it('addVendor validates missing fields', async () => {
    const res = await addVendor({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'Invalid input fields' })
  })

  it('addVendor succeeds and generates UUID', async () => {
    let savedList: any[] = []
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { 
      savedList = await cb([]); 
      return true 
    })
    const fd = { get: (k: string) => k === 'amount' ? '100' : 'test' } as any
    const res = await addVendor({}, fd)
    expect(res).toEqual({ success: true })
    expect(savedList.length).toBe(1)
    expect(savedList[0].id).toMatch(/^ven_12345678-1234-1234-1234-123456789012$/)
  })

  it('addVendor rejects duplicate vendor by name and branch', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ name: 'test', branchId: 'b1', id: 'ven_1' }])
      return true
    })
    const fd = { get: (k: string) => k === 'amount' ? '100' : 'test' } as any
    const res = await addVendor({}, fd)
    expect(res).toEqual({ error: 'A vendor with this name already exists in this branch' })
  })

  it('addVendor handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const fd = { get: (k: string) => k === 'amount' ? '100' : 'test' } as any
    const res = await addVendor({}, fd)
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── addVendorBill ───────────────────────────────────────────────────────
  it('addVendorBill validates missing fields', async () => {
    const res = await addVendorBill({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'Please fill all required bill fields' })
  })

  it('addVendorBill succeeds with invoiceRef and checks categoryId', async () => {
    let savedList: any[] = []
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { 
      savedList = await cb([]); 
      return true 
    })
    const fd = { get: (k: string) => k === 'amount' ? '100' : k === 'isPaid' ? 'on' : k === 'categoryId' ? 'cat_id' : 'test' } as any
    const res = await addVendorBill({}, fd)
    expect(res).toEqual({ success: true })
    expect(savedList.length).toBe(1)
    expect(savedList[0].id).toMatch(/^venexp_12345678-1234-1234-1234-123456789012$/)
    expect(savedList[0].categoryId).toBe('cat_id')
    expect(savedList[0].category).toBeUndefined()
  })

  it('addVendorBill succeeds without invoiceRef', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const fd = { get: (k: string) => {
      if (k === 'amount') return '100'
      if (k === 'invoiceRef') return null
      return 'test'
    }} as any
    const res = await addVendorBill({}, fd)
    expect(res).toEqual({ success: true })
  })

  it('addVendorBill handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockResolvedValue(false)
    const fd = { get: (k: string) => k === 'amount' ? '100' : 'test' } as any
    const res = await addVendorBill({}, fd)
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── markVendorBillAsPaid ────────────────────────────────────────────────
  it('markVendorBillAsPaid handles not found', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const res = await markVendorBillAsPaid('bill_99')
    expect(res).toEqual({ error: 'Bill not found' })
  })

  it('markVendorBillAsPaid succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'bill_99', isPaid: false }])
      return true
    })
    const res = await markVendorBillAsPaid('bill_99')
    expect(res).toEqual({ success: true })
  })

  it('markVendorBillAsPaid handles transaction failure', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => {
      await cb([{ id: 'bill_99', isPaid: false }])
      return false
    })
    const res = await markVendorBillAsPaid('bill_99')
    expect(res).toEqual({ error: 'Transaction failed' })
  })
})
