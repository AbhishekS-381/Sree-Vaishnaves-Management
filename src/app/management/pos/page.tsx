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

  const configList = await db.select().from(configTable).limit(1).catch(() => [])
  const config = configList[0]
  if (!config?.pos) {
    redirect('/management')
  }

  let allBranches = await db
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
    .catch(() => [])

  const isGlobalAdmin = Boolean(session.isGlobalAdmin || session.role === 'admin' || session.role === 'owner')

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

  const todayDataResult = await getTodayPosData(activeBranchId)
  const initialData = 'error' in todayDataResult ? null : todayDataResult

  // Check for stale open orders from prior calendar days (IST)
  const today = todayIST()
  const [staleOrdersRaw, allTables, allCategories] = await Promise.all([
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
    db
      .select()
      .from(posTablesTable)
      .where(and(eq(posTablesTable.branchId, activeBranchId), isNull(posTablesTable.deletedAt)))
      .catch(() => []),
    db
      .select({ id: menuCategoriesTable.id, name: menuCategoriesTable.name })
      .from(menuCategoriesTable)
      .where(isNull(menuCategoriesTable.deletedAt))
      .catch(() => []),
  ])

  const tableMap = new Map((allTables as PosTable[]).map((t) => [t.id, t.name]))

  const staleOrders = (staleOrdersRaw as unknown as PosOrder[]).map((o) => ({
    ...o,
    tableName: o.tableId ? tableMap.get(o.tableId) || 'Table' : o.takeawayNumber || 'Takeaway',
  }))

  const categoryMap = Object.fromEntries(allCategories.map((c) => [c.id, c.name]))

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
