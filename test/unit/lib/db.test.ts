import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Drizzle db instance used by src/lib/db.ts.
// db.ts imports `{ db }` from '../../db/index'.
// Mocks are defined via vi.hoisted so they exist when vi.mock (hoisted) runs.
const { mockDb, selectWhere, insertOnConflictUpdate, insertOnConflictNothing } = vi.hoisted(() => {
  const selectWhere = vi.fn()
  const insertOnConflictUpdate = vi.fn()
  const insertOnConflictNothing = vi.fn()
  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: selectWhere })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: insertOnConflictUpdate,
        onConflictDoNothing: insertOnConflictNothing,
      })),
    })),
  }
  return { mockDb, selectWhere, insertOnConflictUpdate, insertOnConflictNothing }
})

vi.mock('../../../db/index', () => ({ db: mockDb }))
vi.mock('../../../db/schema', () => ({ jsonStore: { filename: 'filename', data: 'data' } }))

import {
  readJSON, writeJSON, withTransaction, DB_FILES,
  branchMenuItemsFile, readBranchMenuItems, withBranchMenuTransaction,
} from '@/lib/db'

describe('lib/db.ts — JSON-blob store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertOnConflictUpdate.mockResolvedValue(undefined)
    insertOnConflictNothing.mockResolvedValue(undefined)
  })

  describe('DB_FILES', () => {
    it('exposes the expected collection filenames', () => {
      expect(DB_FILES.STAFF).toBe('staff.json')
      expect(DB_FILES.EOD).toBe('eod.json')
      expect(DB_FILES.EXPENSES).toBe('expenses.json')
      expect(DB_FILES.USERS).toBe('users.json')
      expect(DB_FILES.AUDIT_LOGS).toBe('audit_logs.json')
    })
  })

  describe('readJSON', () => {
    it('parses and returns the stored JSON array', async () => {
      selectWhere.mockResolvedValue([{ filename: 'staff.json', data: '[{"id":"s1"}]' }])
      const data = await readJSON<{ id: string }>('staff.json')
      expect(data).toEqual([{ id: 's1' }])
    })

    it('returns [] when the row is missing', async () => {
      selectWhere.mockResolvedValue([])
      const data = await readJSON('missing.json')
      expect(data).toEqual([])
    })

    it('returns [] and does not throw when the query errors', async () => {
      selectWhere.mockRejectedValue(new Error('db down'))
      const data = await readJSON('staff.json')
      expect(data).toEqual([])
    })
  })

  describe('writeJSON', () => {
    it('upserts the stringified data and returns true', async () => {
      const ok = await writeJSON('staff.json', [{ id: 's1' }])
      expect(ok).toBe(true)
      expect(mockDb.insert).toHaveBeenCalled()
      expect(insertOnConflictUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ set: { data: '[{"id":"s1"}]' } })
      )
    })

    it('returns false when the write errors', async () => {
      insertOnConflictUpdate.mockRejectedValue(new Error('write failed'))
      const ok = await writeJSON('staff.json', [{ id: 's1' }])
      expect(ok).toBe(false)
    })
  })

  describe('withTransaction', () => {
    it('reads, applies the callback, and writes the result', async () => {
      selectWhere.mockResolvedValue([{ filename: 'staff.json', data: '[]' }])
      const ok = await withTransaction<{ id: string }>('staff.json', (list) => {
        list.push({ id: 'new' })
        return list
      })
      expect(ok).toBe(true)
      expect(insertOnConflictUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ set: { data: '[{"id":"new"}]' } })
      )
    })

    it('supports async callbacks', async () => {
      selectWhere.mockResolvedValue([{ filename: 'staff.json', data: '[]' }])
      const ok = await withTransaction<{ id: string }>('staff.json', async (list) => {
        await Promise.resolve()
        return [...list, { id: 'async' }]
      })
      expect(ok).toBe(true)
    })

    it('serializes concurrent transactions on the same file (mutex)', async () => {
      selectWhere.mockResolvedValue([{ filename: 'staff.json', data: '[]' }])
      const order: string[] = []

      const p1 = withTransaction('staff.json', async () => {
        order.push('start1')
        await new Promise((r) => setTimeout(r, 40))
        order.push('end1')
        return []
      })
      const p2 = withTransaction('staff.json', async () => {
        order.push('start2')
        await new Promise((r) => setTimeout(r, 5))
        order.push('end2')
        return []
      })

      await Promise.all([p1, p2])
      // Second op must not start until the first has released the lock.
      expect(order).toEqual(['start1', 'end1', 'start2', 'end2'])
    })

    it('releases the lock and returns false when the callback throws', async () => {
      selectWhere.mockResolvedValue([{ filename: 'staff.json', data: '[]' }])

      const failing = withTransaction('staff.json', async () => {
        throw new Error('boom')
      })
      const succeeding = withTransaction('staff.json', async () => [{ id: 'ok' }])

      const [r1, r2] = await Promise.all([failing, succeeding])
      expect(r1).toBe(false)
      expect(r2).toBe(true)
    })
  })

  describe('branch menu shard helpers', () => {
    type Row = { id: string; branchId: string; menuItemId: string }

    it('branchMenuItemsFile builds a per-branch filename', () => {
      expect(branchMenuItemsFile('br_1')).toBe('branch_menu_items_br_1.json')
    })

    it('readBranchMenuItems returns the shard when it exists', async () => {
      selectWhere.mockImplementation((...args: any[]) => {
        void args
        return Promise.resolve([
          { filename: 'branch_menu_items_br_1.json', data: '[{"id":"a","branchId":"br_1","menuItemId":"m1"}]' },
        ])
      })
      const rows = await readBranchMenuItems<Row>('br_1')
      expect(rows).toEqual([{ id: 'a', branchId: 'br_1', menuItemId: 'm1' }])
    })

    it('readBranchMenuItems falls back to the legacy blob and filters by branch', async () => {
      // First call (shard) → empty; second call (legacy) → mixed branches
      selectWhere
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          filename: 'branch_menu_items.json',
          data: JSON.stringify([
            { id: 'a', branchId: 'br_1', menuItemId: 'm1' },
            { id: 'b', branchId: 'br_2', menuItemId: 'm1' },
          ]),
        }])
      const rows = await readBranchMenuItems<Row>('br_1')
      expect(rows).toEqual([{ id: 'a', branchId: 'br_1', menuItemId: 'm1' }])
    })

    it('readBranchMenuItems returns [] when neither shard nor legacy has rows', async () => {
      selectWhere.mockResolvedValue([])
      const rows = await readBranchMenuItems<Row>('br_9')
      expect(rows).toEqual([])
    })

    it('withBranchMenuTransaction seeds the shard from legacy on first write', async () => {
      const legacy = JSON.stringify([
        { id: 'a', branchId: 'br_1', menuItemId: 'm1' },
        { id: 'b', branchId: 'br_2', menuItemId: 'm1' },
      ])
      selectWhere
        .mockResolvedValueOnce([])                                                   // shard probe → empty
        .mockResolvedValueOnce([{ filename: 'branch_menu_items.json', data: legacy }]) // legacy read
        .mockResolvedValue([{ filename: 'branch_menu_items_br_1.json', data: JSON.stringify([{ id: 'a', branchId: 'br_1', menuItemId: 'm1' }]) }])

      const ok = await withBranchMenuTransaction<Row>('br_1', rows => rows)
      expect(ok).toBe(true)
      // The seed write must contain only br_1's row
      const seedCall = insertOnConflictUpdate.mock.calls.find(
        c => (c[0] as any).set.data === JSON.stringify([{ id: 'a', branchId: 'br_1', menuItemId: 'm1' }])
      )
      expect(seedCall).toBeTruthy()
    })

    it('withBranchMenuTransaction skips seeding when the shard already has rows', async () => {
      selectWhere.mockResolvedValue([{
        filename: 'branch_menu_items_br_1.json',
        data: JSON.stringify([{ id: 'a', branchId: 'br_1', menuItemId: 'm1' }]),
      }])
      const ok = await withBranchMenuTransaction<Row>('br_1', rows => [
        ...rows, { id: 'new', branchId: 'br_1', menuItemId: 'm2' },
      ])
      expect(ok).toBe(true)
      const lastWrite = insertOnConflictUpdate.mock.calls.at(-1)![0] as any
      expect(JSON.parse(lastWrite.set.data)).toHaveLength(2)
    })

    it('withBranchMenuTransaction does not seed when legacy has no rows for the branch', async () => {
      selectWhere
        .mockResolvedValueOnce([])  // shard empty
        .mockResolvedValueOnce([{ filename: 'branch_menu_items.json', data: JSON.stringify([{ id: 'b', branchId: 'br_2', menuItemId: 'm1' }]) }])
        .mockResolvedValue([])
      const ok = await withBranchMenuTransaction<Row>('br_1', () => [])
      expect(ok).toBe(true)
    })

    it('uses independent mutexes per branch so branches do not block each other', async () => {
      selectWhere.mockResolvedValue([{
        filename: 'x', data: JSON.stringify([{ id: 'a', branchId: 'br_1', menuItemId: 'm1' }]),
      }])
      const order: string[] = []
      const p1 = withBranchMenuTransaction<Row>('br_1', async rows => {
        order.push('start1')
        await new Promise(r => setTimeout(r, 30))
        order.push('end1')
        return rows
      })
      const p2 = withBranchMenuTransaction<Row>('br_2', async rows => {
        order.push('start2')
        await new Promise(r => setTimeout(r, 5))
        order.push('end2')
        return rows
      })
      await Promise.all([p1, p2])
      // Different branches → different mutexes → br_2 finishes while br_1 is still running
      expect(order).toEqual(['start1', 'start2', 'end2', 'end1'])
    })
  })
})
