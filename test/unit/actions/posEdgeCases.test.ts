import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'
import {
  createTable,
  renameTable,
  deactivateTable,
  createOrder,
  addOrUpdateOrderItem,
  removeOrderItem,
  updateOrderNote,
  fireKot,
  generateBill,
  reopenOrder,
  recordPayment,
  voidOrder,
  advanceKotStatus,
  getKitchenKots,
  getPosOrderHistory,
  getDailySummary,
  getPosDataForEOD,
} from '@/app/actions/pos'
import type { PosTable, PosOrder, PosKot } from '@/app/actions/posTypes'

vi.mock('@/lib/db', () => ({
  readJSON: vi.fn(),
  withTransaction: vi.fn(),
  readBranchMenuItems: vi.fn().mockResolvedValue([]),
  DB_FILES: {
    POS_TABLES: 'pos_tables.json',
    POS_ORDERS: 'pos_orders.json',
    POS_KOTS: 'pos_kots.json',
    CONFIG: 'config.json',
    MENU: 'menu.json',
    MENU_ITEM_VARIANTS: 'menu_item_variants.json',
  },
}))

vi.mock('@/lib/audit', () => ({
  logAction: vi.fn().mockResolvedValue(true),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('POS Edge Cases and Guard Branches Coverage (Task 16.2)', () => {
  beforeEach(() => {

    vi.clearAllMocks()
    vi.spyOn(auth, 'getSession').mockResolvedValue({
      userId: 'u_admin',
      role: 'admin',
      isGlobalAdmin: true,
      branchId: 'b_1',
    } as any)
    vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b_1')
    vi.mocked(db.withTransaction).mockResolvedValue(true)
    vi.mocked(db.readJSON).mockResolvedValue([])
  })

  // ─── Table Guards ───────────────────────────────────────────────
  describe('Table Actions Edge Cases', () => {
    it('createTable rejects invalid name and missing branch', async () => {
      const fd1 = new FormData()
      fd1.set('name', '')
      fd1.set('branchId', 'b_1')
      const res1 = await createTable(null, fd1)
      expect(res1?.error).toBeDefined()

      const fd2 = new FormData()
      fd2.set('name', 'Table 1')
      fd2.set('branchId', '')
      const res2 = await createTable(null, fd2)
      expect(res2?.error).toBe('Branch is required')
    })

    it('createTable handles branchAccessDenied and transaction failure', async () => {
      vi.spyOn(auth, 'requireBranchAccess').mockRejectedValueOnce(new Error('Denied'))
      const fd = new FormData()
      fd.set('name', 'Table 1')
      fd.set('branchId', 'b_denied')
      const res = await createTable(null, fd)
      expect(res?.error).toBe('BranchAccessDenied')

      vi.mocked(db.withTransaction).mockResolvedValueOnce(false)
      const resFail = await createTable(null, fd)
      expect(resFail?.error).toBe('Transaction failed')
    })

    it('renameTable handles not found, duplicate name, and transaction failure', async () => {
      // not found
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        mutator([])
        return true
      })
      const fd = new FormData()
      fd.set('tableId', 't_unknown')
      fd.set('newName', 'T New')
      fd.set('branchId', 'b_1')
      const resNotFound = await renameTable(null, fd)
      expect(resNotFound?.error).toBe('Table not found')

      // duplicate name
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const list: PosTable[] = [
          { id: 't1', branchId: 'b_1', name: 'Existing', isActive: true, createdAt: '', updatedAt: '' },
          { id: 't2', branchId: 'b_1', name: 'Other', isActive: true, createdAt: '', updatedAt: '' },
        ]
        mutator(list)
        return true
      })
      const fdDup = new FormData()
      fdDup.set('tableId', 't1')
      fdDup.set('newName', 'Other')
      fdDup.set('branchId', 'b_1')
      const resDup = await renameTable(null, fdDup)
      expect(resDup?.error).toBe('A table with this name already exists')

      // transaction failure
      vi.mocked(db.withTransaction).mockResolvedValueOnce(false)
      const resFail = await renameTable(null, fd)
      expect(resFail?.error).toBe('Transaction failed')
    })

    it('deactivateTable handles not found and transaction failure', async () => {
      vi.mocked(db.readJSON).mockResolvedValueOnce([])
      const resNotFound = await deactivateTable('t_none')
      expect(resNotFound?.error).toBe('Table not found')

      vi.mocked(db.readJSON).mockResolvedValueOnce([
        { id: 't1', branchId: 'b_1', name: 'T1', isActive: true, createdAt: '', updatedAt: '' },
      ])
      vi.mocked(db.withTransaction).mockResolvedValueOnce(false)
      const resFail = await deactivateTable('t1')
      expect(resFail?.error).toBe('Transaction failed')
    })
  })

  // ─── Order Lifecycle Guards ─────────────────────────────────────
  describe('Order Lifecycle Edge Cases', () => {
    it('createOrder rejects dine-in without table and takeaway with table', async () => {
      const fdDineNoTable = new FormData()
      fdDineNoTable.set('orderType', 'dine-in')
      fdDineNoTable.set('branchId', 'b_1')
      const res1 = await createOrder(null, fdDineNoTable)
      expect(res1?.error).toBe('Table is required for dine-in orders')

      const fdTakeawayWithTable = new FormData()
      fdTakeawayWithTable.set('orderType', 'takeaway')
      fdTakeawayWithTable.set('branchId', 'b_1')
      fdTakeawayWithTable.set('tableId', 't1')
      const res2 = await createOrder(null, fdTakeawayWithTable)
      expect(res2?.error).toBe('Takeaway orders must not have a table assigned')
    })

    it('createOrder handles branch access rejection and transaction failure', async () => {
      vi.spyOn(auth, 'requireBranchAccess').mockRejectedValueOnce(new Error('Denied'))
      const fd = new FormData()
      fd.set('orderType', 'takeaway')
      fd.set('branchId', 'b_denied')
      const res = await createOrder(null, fd)
      expect(res?.error).toBe('BranchAccessDenied')

      vi.mocked(db.withTransaction).mockResolvedValueOnce(false)
      const resFail = await createOrder(null, fd)
      expect(resFail?.error).toBe('Transaction failed')
    })

    it('addOrUpdateOrderItem handles validation error and not open order', async () => {
      // validation error: quantity 0
      const resVal = await addOrUpdateOrderItem('o1', 'm1', 0, 100, 'Name')
      expect(resVal?.error).toBeDefined()

      // not found
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        mutator([])
        return true
      })
      const resNotFound = await addOrUpdateOrderItem('o_none', 'm1', 1, 100, 'Name')
      expect(resNotFound?.error).toBe('Order not found')

      // not open
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const orders: PosOrder[] = [
          { id: 'o_billed', branchId: 'b_1', status: 'billed', items: [], kotCount: 1, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
        ]
        mutator(orders)
        return true
      })
      const resNotOpen = await addOrUpdateOrderItem('o_billed', 'm1', 1, 100, 'Name')
      expect(resNotOpen?.error).toBe('Order is not open')
    })

    it('removeOrderItem handles item not found and transaction failure', async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const orders: PosOrder[] = [
          { id: 'o1', branchId: 'b_1', status: 'open', items: [], kotCount: 0, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
        ]
        mutator(orders)
        return true
      })
      const res = await removeOrderItem('o1', 'item_none')
      expect(res?.error).toBe('Order item not found')

      vi.mocked(db.withTransaction).mockResolvedValueOnce(false)
      const resFail = await removeOrderItem('o1', 'item_none')
      expect(resFail?.error).toBeDefined()
    })

    it('updateOrderNote handles not open order and transaction failure', async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const orders: PosOrder[] = [
          { id: 'o1', branchId: 'b_1', status: 'paid', items: [], kotCount: 0, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
        ]
        mutator(orders)
        return true
      })
      const res = await updateOrderNote('o1', 'note')
      expect(res?.error).toBe('Order is not open')
    })
  })

  // ─── KOT & Bill Guards ──────────────────────────────────────────
  describe('KOT and Bill Edge Cases', () => {
    it('fireKot rejects when order is not open or not found', async () => {
      vi.mocked(db.readJSON).mockResolvedValueOnce([])
      const resNotFound = await fireKot('o_none')
      expect(resNotFound?.error).toBe('Order not found')

      vi.mocked(db.readJSON).mockResolvedValueOnce([
        { id: 'o_billed', branchId: 'b_1', status: 'billed', items: [{ id: '1' }], kotCount: 0 },
      ])
      const resNotOpen = await fireKot('o_billed')
      expect(resNotOpen?.error).toBe('Order is not open')
    })

    it('generateBill handles zero-bill confirmation flow and discount > subtotal', async () => {
      const fd = new FormData()
      fd.set('orderId', 'o1')
      fd.set('discount', '500')
      fd.set('gst', '0')

      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const orders: PosOrder[] = [
          {
            id: 'o1',
            branchId: 'b_1',
            status: 'open',
            items: [{ id: 'i1', menuItemId: 'm1', nameSnapshot: 'Item', unitPrice: 100, quantity: 1 }],
            kotCount: 1,
            date: '',
            openedBy: 'u_admin',
            orderType: 'dine-in',
            createdAt: '',
            updatedAt: '',
          },
        ]
        mutator(orders)
        return true
      })
      const resDiscount = await generateBill(null, fd)
      expect(resDiscount?.error).toBe('Discount cannot exceed the subtotal')

      // Zero bill unconfirmed
      const fdZero = new FormData()
      fdZero.set('orderId', 'o1')
      fdZero.set('discount', '100')
      fdZero.set('gst', '0')

      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const orders: PosOrder[] = [
          {
            id: 'o1',
            branchId: 'b_1',
            status: 'open',
            items: [{ id: 'i1', menuItemId: 'm1', nameSnapshot: 'Item', unitPrice: 100, quantity: 1 }],
            kotCount: 1,
            date: '',
            openedBy: 'u_admin',
            orderType: 'dine-in',
            createdAt: '',
            updatedAt: '',
          },
        ]
        mutator(orders)
        return true
      })
      const resZero = await generateBill(null, fdZero)
      expect(resZero?.error).toBe('ZERO_BILL_CONFIRM_REQUIRED')
    })

    it('advanceKotStatus handles already served and invalid transitions', async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const kots: PosKot[] = [
          { id: 'k1', branchId: 'b_1', orderId: 'o1', kotNumber: 1, items: [], status: 'served', firedBy: 'u1', firedAt: '', updatedAt: '' },
        ]
        mutator(kots)
        return true
      })
      const resServed = await advanceKotStatus('k1')
      expect(resServed?.error).toBe('KOT is already served')

      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const kots: PosKot[] = [
          { id: 'k2', branchId: 'b_1', orderId: 'o1', kotNumber: 1, items: [], status: 'unknown_status' as any, firedBy: 'u1', firedAt: '', updatedAt: '' },
        ]
        mutator(kots)
        return true
      })
      const resInvalid = await advanceKotStatus('k2')
      expect(resInvalid?.error).toBe('Invalid KOT status transition')
    })

    it('getPosOrderHistory validates date format and rejects invalid range', async () => {
      const resBadDate = await getPosOrderHistory('b_1', 'bad-date', '2026-10-19')
      expect(resBadDate?.error).toBe('Invalid date format')

      const resInverted = await getPosOrderHistory('b_1', '2026-10-25', '2026-10-19')
      expect(resInverted?.error).toBe('From date must be on or before to date')
    })
  })

  // ─── Unauthorized and BranchAccessDenied for all actions ─────────
  describe('Unauthorized session checks', () => {
    beforeEach(() => {
      vi.spyOn(auth, 'getSession').mockResolvedValue(null)
    })

    it('all POS actions return Unauthorized when getSession returns null', async () => {
      const fd = new FormData()
      fd.set('orderId', 'o1')
      fd.set('reason', 'mistake')
      expect((await createTable(null, fd))?.error).toBe('Unauthorized')
      expect((await renameTable(null, fd))?.error).toBe('Unauthorized')
      expect((await deactivateTable('t1'))?.error).toBe('Unauthorized')
      expect((await createOrder(null, fd))?.error).toBe('Unauthorized')
      expect((await addOrUpdateOrderItem('o1', 'm1', 1, 100, 'Name'))?.error).toBe('Unauthorized')
      expect((await removeOrderItem('o1', 'i1'))?.error).toBe('Unauthorized')
      expect((await updateOrderNote('o1', 'note'))?.error).toBe('Unauthorized')
      expect((await fireKot('o1'))?.error).toBe('Unauthorized')
      expect((await generateBill(null, fd))?.error).toBe('Unauthorized')
      expect((await reopenOrder('o1'))?.error).toBe('Unauthorized')
      expect((await recordPayment(null, fd))?.error).toBe('Unauthorized')
      expect((await voidOrder(null, fd))?.error).toBe('Unauthorized')
      expect((await advanceKotStatus('k1'))?.error).toBe('Unauthorized')
      expect((await getKitchenKots('b_1'))?.error).toBe('Unauthorized')
      expect((await getPosOrderHistory('b_1', '2026-10-01', '2026-10-02'))?.error).toBe('Unauthorized')
      expect((await getDailySummary('b_1', '2026-10-01'))?.error).toBe('Unauthorized')
      expect((await getPosDataForEOD('2026-10-01', 'b_1'))?.error).toBe('Unauthorized')
    })
  })

  describe('BranchAccessDenied when requireBranchAccess throws', () => {
    beforeEach(() => {
      vi.spyOn(auth, 'getSession').mockResolvedValue({
        userId: 'u_admin',
        role: 'admin',
        isGlobalAdmin: true,
        branchId: 'b_1',
      } as any)
      vi.spyOn(auth, 'requireBranchAccess').mockRejectedValue(new Error('Denied'))
    })

    it('actions return BranchAccessDenied when branch access fails', async () => {
      const fd = new FormData()
      fd.set('orderId', 'o1')
      fd.set('discount', '0')
      fd.set('gst', '0')
      fd.set('method', 'cash')
      fd.set('reason', 'test')

      expect((await removeOrderItem('o1', 'i1'))?.error).toBe('BranchAccessDenied')
      expect((await updateOrderNote('o1', 'note'))?.error).toBe('BranchAccessDenied')
      expect((await fireKot('o1'))?.error).toBe('BranchAccessDenied')
      expect((await generateBill(null, fd))?.error).toBe('BranchAccessDenied')
      expect((await reopenOrder('o1'))?.error).toBe('BranchAccessDenied')
      expect((await recordPayment(null, fd))?.error).toBe('BranchAccessDenied')
      expect((await voidOrder(null, fd))?.error).toBe('BranchAccessDenied')
      expect((await advanceKotStatus('k1'))?.error).toBe('BranchAccessDenied')
      expect((await getKitchenKots('b_1'))?.error).toBe('BranchAccessDenied')
      expect((await getDailySummary('b_1', '2026-10-01'))?.error).toBe('BranchAccessDenied')
      expect((await getPosDataForEOD('2026-10-01', 'b_1'))?.error).toBe('BranchAccessDenied')
    })
  })

  describe('Transaction inner guards and branches', () => {
    beforeEach(() => {
      vi.spyOn(auth, 'getSession').mockResolvedValue({
        userId: 'u_admin',
        role: 'admin',
        isGlobalAdmin: true,
        branchId: 'b_1',
      } as any)
      vi.spyOn(auth, 'requireBranchAccess').mockResolvedValue('b_1')
    })

    it('removeOrderItem handles branch mismatch', async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const orders: PosOrder[] = [
          { id: 'o1', branchId: 'b_other', status: 'open', items: [{ id: 'i1' } as any], kotCount: 0, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
        ]
        mutator(orders)
        return true
      })
      const res = await removeOrderItem('o1', 'i1')
      expect(res?.error).toBe('BranchAccessDenied')
    })

    it('updateOrderNote handles branch mismatch and note length validation', async () => {
      const longNote = 'a'.repeat(201)
      const resLong = await updateOrderNote('o1', longNote)
      expect(resLong?.error).toBe('Note must be at most 200 characters')

      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const orders: PosOrder[] = [
          { id: 'o1', branchId: 'b_other', status: 'open', items: [], kotCount: 0, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
        ]
        mutator(orders)
        return true
      })
      const resMismatch = await updateOrderNote('o1', 'valid note')
      expect(resMismatch?.error).toBe('BranchAccessDenied')
    })

    it('reopenOrder handles not found and branch mismatch', async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        mutator([])
        return true
      })
      const resNotFound = await reopenOrder('o_missing')
      expect(resNotFound?.error).toBe('Order not found')

      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const orders: PosOrder[] = [
          { id: 'o1', branchId: 'b_other', status: 'billed', items: [], kotCount: 1, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
        ]
        mutator(orders)
        return true
      })
      const resMismatch = await reopenOrder('o1')
      expect(resMismatch?.error).toBe('BranchAccessDenied')
    })

    it('recordPayment handles not found, branch mismatch, not billed, and no bill', async () => {
      const fd = new FormData()
      fd.set('orderId', 'o1')
      fd.set('method', 'cash')

      // not found
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        mutator([])
        return true
      })
      expect((await recordPayment(null, fd))?.error).toBe('Order not found')

      // branch mismatch
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const orders: PosOrder[] = [
          { id: 'o1', branchId: 'b_other', status: 'billed', bill: { subtotal: 100, discount: 0, gst: 0, totalPayable: 100, generatedAt: '' }, items: [], kotCount: 1, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
        ]
        mutator(orders)
        return true
      })
      expect((await recordPayment(null, fd))?.error).toBe('BranchAccessDenied')

      // not billed
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const orders: PosOrder[] = [
          { id: 'o1', branchId: 'b_1', status: 'open', items: [], kotCount: 1, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
        ]
        mutator(orders)
        return true
      })
      expect((await recordPayment(null, fd))?.error).toBe('Order must be billed before payment')

      // no bill
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const orders: PosOrder[] = [
          { id: 'o1', branchId: 'b_1', status: 'billed', items: [], kotCount: 1, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
        ]
        mutator(orders)
        return true
      })
      expect((await recordPayment(null, fd))?.error).toBe('Order has no bill')

      // method UPI auto-sets upiAmount
      const fdUpi = new FormData()
      fdUpi.set('orderId', 'o1')
      fdUpi.set('method', 'upi')
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const orders: PosOrder[] = [
          { id: 'o1', branchId: 'b_1', status: 'billed', bill: { subtotal: 100, discount: 0, gst: 0, totalPayable: 100, generatedAt: '' }, items: [], kotCount: 1, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
        ]
        mutator(orders)
        return true
      })
      const resUpi = await recordPayment(null, fdUpi)
      expect(resUpi?.success).toBe(true)

      // totalPayable > 0 but both cash and upi are 0
      const fdZero = new FormData()
      fdZero.set('orderId', 'o1')
      fdZero.set('method', 'split')
      fdZero.set('cashAmount', '0')
      fdZero.set('upiAmount', '0')
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const orders: PosOrder[] = [
          { id: 'o1', branchId: 'b_1', status: 'billed', bill: { subtotal: 100, discount: 0, gst: 0, totalPayable: 100, generatedAt: '' }, items: [], kotCount: 1, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
        ]
        mutator(orders)
        return true
      })
      expect((await recordPayment(null, fdZero))?.error).toBe('Payment amounts do not balance with total payable')
    })

    it('voidOrder handles not found, branch mismatch, and wrong status', async () => {
      const fdVoid = new FormData()
      fdVoid.set('orderId', 'o1')
      fdVoid.set('reason', 'mistake')

      // not found
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        mutator([])
        return true
      })
      expect((await voidOrder(null, fdVoid))?.error).toBe('Order not found')

      // branch mismatch
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const orders: PosOrder[] = [
          { id: 'o1', branchId: 'b_other', status: 'open', items: [], kotCount: 0, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
        ]
        mutator(orders)
        return true
      })
      expect((await voidOrder(null, fdVoid))?.error).toBe('BranchAccessDenied')

      // wrong status (e.g. billed)
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const orders: PosOrder[] = [
          { id: 'o1', branchId: 'b_1', status: 'billed', items: [], kotCount: 0, date: '', openedBy: 'u_admin', orderType: 'dine-in', createdAt: '', updatedAt: '' },
        ]
        mutator(orders)
        return true
      })
      expect((await voidOrder(null, fdVoid))?.error).toBe('Only open or paid orders can be voided')
    })

    it('advanceKotStatus handles not found and branch mismatch', async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        mutator([])
        return true
      })
      expect((await advanceKotStatus('k_missing'))?.error).toBe('KOT not found')

      vi.mocked(db.withTransaction).mockImplementationOnce(async (_file, mutator) => {
        const kots: PosKot[] = [
          { id: 'k1', branchId: 'b_other', orderId: 'o1', kotNumber: 1, items: [], status: 'pending', firedBy: 'u1', firedAt: '', updatedAt: '' },
        ]
        mutator(kots)
        return true
      })
      expect((await advanceKotStatus('k1'))?.error).toBe('BranchAccessDenied')
    })

    it('getPosOrderHistory enforces branch access for non-admin owners', async () => {
      vi.spyOn(auth, 'getSession').mockResolvedValue({
        userId: 'u_owner',
        role: 'owner',
        isGlobalAdmin: false,
        branchId: 'b_1',
      } as any)

      // owner requesting different branch
      const resDenied = await getPosOrderHistory('b_2', '2026-10-01', '2026-10-02')
      expect(resDenied?.error).toBe('BranchAccessDenied')

      // owner requesting own branch
      vi.mocked(db.readJSON).mockResolvedValueOnce([])
      const resAllowed = await getPosOrderHistory('b_1', '2026-10-01', '2026-10-02')
      expect(resAllowed?.orders).toBeDefined()
    })

    it('getPosDataForEOD validates date and branchId', async () => {
      expect((await getPosDataForEOD('bad-date', 'b_1'))?.error).toBe('Invalid date format')
      expect((await getPosDataForEOD('2026-10-19', ''))?.error).toBe('Branch is required')
    })
  })
})


