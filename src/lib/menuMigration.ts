'use server'

import {
  readJSON,
  writeJSON,
  DB_FILES,
  branchMenuItemsFile,
} from '@/lib/db'
import { getSession } from '@/app/actions/auth'
import { logAction } from '@/lib/audit'

type BranchMenuItemRow = {
  id: string
  branchId: string
  menuItemId: string
  variantId?: string
  price: number | null
  isAvailable: boolean
}

export type MigrationReport = {
  legacyRows: number
  branches: { branchId: string; rows: number; status: 'migrated' | 'skipped' | 'failed' }[]
  migrated: number
  skipped: number
  failed: number
}

/**
 * One-shot migration: split the legacy combined `branch_menu_items.json` blob
 * into per-branch shards (`branch_menu_items_<branchId>.json`).
 *
 * Safety properties:
 *  - **Idempotent.** A branch whose shard already has rows is SKIPPED, never
 *    overwritten — so re-running can't regress rows written after migration.
 *  - **Non-destructive.** The legacy blob is intentionally left in place so the
 *    read-through fallback keeps working and a rollback is always possible.
 *  - Admin/owner only.
 */
export async function migrateBranchMenuItemsToShards(): Promise<
  { success: true; report: MigrationReport } | { error: string }
> {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  const legacy = await readJSON<BranchMenuItemRow>(DB_FILES.BRANCH_MENU_ITEMS)

  const report: MigrationReport = {
    legacyRows: legacy.length,
    branches: [],
    migrated: 0,
    skipped: 0,
    failed: 0,
  }

  if (legacy.length === 0) {
    return { success: true, report }
  }

  // Group legacy rows by branch
  const byBranch = new Map<string, BranchMenuItemRow[]>()
  for (const row of legacy) {
    if (!row?.branchId) continue
    const list = byBranch.get(row.branchId) ?? []
    list.push(row)
    byBranch.set(row.branchId, list)
  }

  for (const [branchId, rows] of byBranch.entries()) {
    const file = branchMenuItemsFile(branchId)
    const existing = await readJSON<BranchMenuItemRow>(file)

    if (existing.length > 0) {
      report.branches.push({ branchId, rows: existing.length, status: 'skipped' })
      report.skipped++
      continue
    }

    const ok = await writeJSON<BranchMenuItemRow>(file, rows)
    if (!ok) {
      report.branches.push({ branchId, rows: rows.length, status: 'failed' })
      report.failed++
      continue
    }

    // Verify the shard reads back with the expected row count
    const verify = await readJSON<BranchMenuItemRow>(file)
    if (verify.length !== rows.length) {
      report.branches.push({ branchId, rows: verify.length, status: 'failed' })
      report.failed++
      continue
    }

    report.branches.push({ branchId, rows: rows.length, status: 'migrated' })
    report.migrated++
  }

  await logAction(
    'MIGRATE_BRANCH_MENU_SHARDS',
    'MENU',
    JSON.stringify({
      legacyRows: report.legacyRows,
      migrated: report.migrated,
      skipped: report.skipped,
      failed: report.failed,
    })
  )

  return { success: true, report }
}
