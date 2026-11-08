import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockTransaction, mockDb } = vi.hoisted(() => {
  const mockTransaction = vi.fn()
  const mockDb = {
    transaction: mockTransaction,
  }
  return { mockTransaction, mockDb }
})

vi.mock('../../../db/index', () => ({
  db: mockDb,
}))

import { withDbTransaction, db, branches, staff, posOrders, posTables, posKots } from '@/lib/db'

describe('src/lib/db.ts — RDBMS Helper Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('db export and table re-exports', () => {
    it('re-exports db instance and core schema tables', () => {
      expect(db).toBe(mockDb)
      expect(branches).toBeDefined()
      expect(staff).toBeDefined()
      expect(posOrders).toBeDefined()
      expect(posTables).toBeDefined()
      expect(posKots).toBeDefined()
    })
  })

  describe('withDbTransaction', () => {
    it('executes callback inside db.transaction and returns result on success', async () => {
      const mockTx = { select: vi.fn(), insert: vi.fn() }
      mockTransaction.mockImplementation(async (cb: any) => {
        return cb(mockTx)
      })

      const result = await withDbTransaction(async (tx: any) => {
        expect(tx).toBe(mockTx)
        return { orderId: 'ord_123', total: 500 }
      })

      expect(mockTransaction).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ orderId: 'ord_123', total: 500 })
    })

    it('passes isolationLevel options to db.transaction', async () => {
      const mockTx = {}
      mockTransaction.mockImplementation(async (cb: any) => {
        return cb(mockTx)
      })

      await withDbTransaction(
        async () => 'ok',
        { isolationLevel: 'serializable' }
      )

      expect(mockTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'serializable' }
      )
    })

    it('propagates error and triggers rollback when callback throws', async () => {
      mockTransaction.mockImplementation(async (cb: any) => {
        return cb({})
      })

      await expect(
        withDbTransaction(async () => {
          throw new Error('Deadlock detected')
        })
      ).rejects.toThrow('Deadlock detected')

      expect(mockTransaction).toHaveBeenCalledTimes(1)
    })
  })
})
