import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'
import {
  db,
  branches as branchesTable,
  config as configTable,
  posOrders as posOrdersTable,
  posTables as posTablesTable,
  menuCategories as menuCategoriesTable,
} from '@/lib/db'
import { eq, and, isNull, lt } from 'drizzle-orm'
import { getTodayPosData } from '@/app/actions/pos'
import type { PosOrder, PosTable } from '@/app/actions/posTypes'
import PosClientPage from './PosClientPage'
import { resolvePosBranchId } from '@/lib/posUtils'

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export async function loadPosDashboardPage(
  branchParam?: string,
  searchParams?: Promise<{ branch?: string }>
) {
  const session = await getSession()
  if (!session) {
    redirect('/management/login')
    return null as any
  }

  // Dedicated POS roles are locked to their own pages
  if (session.posRole) {
    if (session.role === 'billing') redirect('/management/pos/billing')
    if (session.role === 'kitchen') redirect('/management/pos/kitchen')
    if (session.role === 'waiter') redirect('/management/pos/order')
    redirect('/management')
  }

  // Only manager, owner, admin can access main POS dashboard
  if (!['manager', 'owner', 'admin'].includes(session.role)) {
    redirect('/management')
  }

  const [configList, allBranchesRaw] = await Promise.all([
    db.select().from(configTable).limit(1).catch(() => []),
    db
      .select({
        id: branchesTable.id,
        name: branchesTable.name,
        address: branchesTable.address,
        phone: branchesTable.phone,
        gstin: branchesTable.gstin,
        isActive: branchesTable.isActive,
      })
      .from(branchesTable)
      .where(and(eq(branchesTable.isActive, true), isNull(branchesTable.deletedAt)))
      .catch(() => []),
  ])

  const config = configList[0]
  if (!config?.pos) {
    redirect('/management')
  }

  const isGlobalAdmin = Boolean(session.isGlobalAdmin || session.role === 'admin' || session.role === 'owner')
  let allBranches = allBranchesRaw
  if (!isGlobalAdmin) {
    allBranches = allBranches.filter((b) => b.id === session.branchId)
  }

  const resolvedParams = searchParams ? await searchParams : undefined
  const requestedBranch = branchParam || resolvedParams?.branch
  const fallbackBranchId = (isGlobalAdmin ? allBranches[0]?.id : session.branchId) || ''
  const activeBranchId = isGlobalAdmin
    ? resolvePosBranchId(requestedBranch, allBranches, fallbackBranchId)
    : (session.branchId || fallbackBranchId)

  if (!activeBranchId) {
    redirect('/management')
  }

  // Run getTodayPosData and stale orders query concurrently
  const today = todayIST()
  const [todayDataResult, staleOrdersRaw] = await Promise.all([
    getTodayPosData(activeBranchId),
    db
      .select()
      .from(posOrdersTable)
      .where(
        and(
          eq(posOrdersTable.branchId, activeBranchId),
          eq(posOrdersTable.status, 'open'),
          lt(posOrdersTable.date, today)
        )
      )
      .catch(() => []),
  ])
  const initialData = 'error' in todayDataResult ? null : todayDataResult

  // Reuse tables already loaded in todayDataResult
  const tables = initialData?.tables || []
  const tableMap = new Map((tables as PosTable[]).map((t) => [t.id, t.name]))

  const staleOrders = (staleOrdersRaw as unknown as PosOrder[]).map((o) => ({
    ...o,
    tableName: o.tableId ? tableMap.get(o.tableId) || 'Table' : o.takeawayNumber || 'Takeaway',
  }))

  // Reuse categories from todayDataResult
  const categoriesList = (initialData as any)?.categories || []
  let categoryMap: Record<string, string> = {}
  if (categoriesList.length > 0) {
    categoryMap = Object.fromEntries(categoriesList.map((c: any) => [c.id, c.name]))
  } else if (initialData?.catalog) {
    for (const item of initialData.catalog) {
      if (item.categoryId && item.categoryName) {
        categoryMap[item.categoryId] = item.categoryName
      }
    }
  }

  return (
    <PosClientPage
      branches={allBranches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address ?? undefined,
        phone: b.phone ?? undefined,
        gstin: b.gstin ?? undefined,
      }))}
      activeBranchId={activeBranchId}
      initialData={initialData}
      staleOrders={staleOrders}
      session={session}
      categoryMap={categoryMap}
      posDefaultGstPercent={config?.posDefaultGstPercent ?? 0}
      posDefaultParcelPercent={config?.posDefaultParcelPercent ?? 0}
      posDefaultAcPercent={config?.posDefaultAcPercent ?? 0}
      posPricingMode={(config?.posPricingMode as 'percentage' | 'item_price') ?? 'percentage'}
    />
  )
}

export default async function PosDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ branch?: string }>
}) {
  return loadPosDashboardPage(undefined, searchParams)
}
