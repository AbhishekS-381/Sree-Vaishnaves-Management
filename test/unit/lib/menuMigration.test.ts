import { describe, it, expect, vi, beforeEach } from 'vitest'
import { migrateBranchMenuItemsToShards } from '@/lib/menuMigration'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'
import * as audit from '@/lib/audit'

vi.mock('@/lib/db', () => ({
  readJSON: vi.fn(),
  writeJSON: vi.fn(),
  branchMenuItemsFile: (b: string) => `branch_menu_items_${b}.json`,
  DB_FILES: { BRANCH_MENU_ITEMS: 'branch_menu_items.json' },
}))
vi.mock('@/app/actions/auth', () => ({ getSession: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAction: vi.fn() }))

const legacyRows = [
  { id: 'a', branchId: 'br_1', menuItemId: 'm1', price: null, isAvailable: true },
  { id: 'b', branchId: 'br_1', menuItemId: 'm2', price: 90, isAvailable: true },
  { id: 'c', branchId: 'br_2', menuItemId: 'm1', price: null, isAvailable: false },
]

describe('menuMigration — migrateBranchMenuItemsToShards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth.getSession).mockResolvedValue({ isGlobalAdmin: true } as any)
    vi.mocked(db.writeJSON).mockResolvedValue(true)
  })

  it('rejects non-global-admins', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ isGlobalAdmin: false } as any)
    const res = await migrateBranchMenuItemsToShards()
    expect(res).toEqual({ error: 'Forbidden: Admin or Owner access required' })
    expect(db.writeJSON).not.toHaveBeenCalled()
  })

  it('rejects when there is no session', async () => {
    vi.mocked(auth.getSession).mockResolvedValue(null as any)
    const res = await migrateBranchMenuItemsToShards()
    expect('error' in res).toBe(true)
  })

  it('returns an empty report when the legacy blob is empty', async () => {
    vi.mocked(db.readJSON).mockResolvedValue([])
    const res = await migrateBranchMenuItemsToShards()
    expect(res).toEqual({ success: true, report: { legacyRows: 0, branches: [], migrated: 0, skipped: 0, failed: 0 } })
    expect(db.writeJSON).not.toHaveBeenCalled()
  })

  it('splits legacy rows into per-branch shards', async () => {
    vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
      if (file === 'branch_menu_items.json') return legacyRows as any
      return [] as any               // shards start empty
    })
    // verification read should return the written rows
    let written: Record<string, any[]> = {}
    vi.mocked(db.writeJSON).mockImplementation(async (file: string, data: any[]) => {
      written[file] = data
      return true
    })
    vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
      if (file === 'branch_menu_items.json') return legacyRows as any
      return (written[file] ?? []) as any
    })

    const res = await migrateBranchMenuItemsToShards()
    expect('success' in res && res.success).toBe(true)
    if (!('report' in res)) throw new Error('no report')

    expect(res.report.legacyRows).toBe(3)
    expect(res.report.migrated).toBe(2)
    expect(res.report.failed).toBe(0)
    expect(written['branch_menu_items_br_1.json']).toHaveLength(2)
    expect(written['branch_menu_items_br_2.json']).toHaveLength(1)
  })

  it('skips branches whose shard already has rows (idempotent, no overwrite)', async () => {
    const written: Record<string, any[]> = {}
    vi.mocked(db.writeJSON).mockImplementation(async (file: string, data: any[]) => {
      written[file] = data
      return true
    })
    vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
      if (file === 'branch_menu_items.json') return legacyRows as any
      if (file === 'branch_menu_items_br_1.json') return [{ id: 'newer', branchId: 'br_1' }] as any
      return (written[file] ?? []) as any
    })
    const res = await migrateBranchMenuItemsToShards()
    if (!('report' in res)) throw new Error('no report')

    expect(res.report.skipped).toBe(1)
    expect(res.report.migrated).toBe(1)
    // br_1 must NOT be rewritten
    const wroteBr1 = vi.mocked(db.writeJSON).mock.calls.some(c => c[0] === 'branch_menu_items_br_1.json')
    expect(wroteBr1).toBe(false)
  })

  it('records a failure when the write fails', async () => {
    vi.mocked(db.readJSON).mockImplementation(async (file: string) =>
      (file === 'branch_menu_items.json' ? legacyRows : []) as any
    )
    vi.mocked(db.writeJSON).mockResolvedValue(false)
    const res = await migrateBranchMenuItemsToShards()
    if (!('report' in res)) throw new Error('no report')
    expect(res.report.failed).toBe(2)
    expect(res.report.migrated).toBe(0)
  })

  it('records a failure when verification row counts mismatch', async () => {
    vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
      if (file === 'branch_menu_items.json') return legacyRows as any
      return [] as any             // shard probe empty AND verification returns empty → mismatch
    })
    vi.mocked(db.writeJSON).mockResolvedValue(true)
    const res = await migrateBranchMenuItemsToShards()
    if (!('report' in res)) throw new Error('no report')
    expect(res.report.failed).toBe(2)
  })

  it('ignores legacy rows without a branchId', async () => {
    vi.mocked(db.readJSON).mockImplementation(async (file: string) =>
      (file === 'branch_menu_items.json'
        ? [{ id: 'x', menuItemId: 'm1' }, ...legacyRows]
        : []) as any
    )
    const res = await migrateBranchMenuItemsToShards()
    if (!('report' in res)) throw new Error('no report')
    expect(res.report.branches.map(b => b.branchId).sort()).toEqual(['br_1', 'br_2'])
  })

  it('writes an audit entry', async () => {
    vi.mocked(db.readJSON).mockImplementation(async (file: string) =>
      (file === 'branch_menu_items.json' ? legacyRows : []) as any
    )
    await migrateBranchMenuItemsToShards()
    expect(audit.logAction).toHaveBeenCalledWith(
      'MIGRATE_BRANCH_MENU_SHARDS', 'MENU', expect.stringContaining('legacyRows')
    )
  })
})
