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

  it('addVendor succeeds', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const fd = { get: (k: string) => k === 'amount' ? '100' : 'test' } as any
    const res = await addVendor({}, fd)
    expect(res).toEqual({ success: true })
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

  it('addVendorBill succeeds with invoiceRef', async () => {
    vi.mocked(db.withTransaction).mockImplementation(async (_f, cb) => { await cb([]); return true })
    const fd = { get: (k: string) => k === 'amount' ? '100' : k === 'isPaid' ? 'on' : 'test' } as any
    const res = await addVendorBill({}, fd)
    expect(res).toEqual({ success: true })
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
