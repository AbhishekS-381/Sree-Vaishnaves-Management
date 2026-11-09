import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'
import {
  db,
  branches as branchesTable,
  config as configTable,
  posOrders as posOrdersTable,
  posTables as posTablesTable,
} from '@/lib/db'
import { eq, and, isNull } from 'drizzle-orm'
import type { PosOrder, PosTable } from '@/app/actions/posTypes'
import BillingClientPage from './BillingClientPage'
import { resolvePosBranchId } from '@/lib/posUtils'

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export async function loadBillingPage(
  branchParam?: string,
  searchParams?: Promise<{ branch?: string }>
) {
  const session = await getSession()
  if (!session) {
    redirect('/management/login')
    return null as any
  }

  // Allowed roles: billing, manager, owner, admin
  if (!['billing', 'manager', 'owner', 'admin'].includes(session.role)) {
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

  let allBranches = allBranchesRaw.map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address || undefined,
    phone: b.phone || undefined,
    gstin: b.gstin || undefined,
    isActive: b.isActive,
  }))

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

  const today = todayIST()
  const [allOrdersRaw, allTables] = await Promise.all([
    db
      .select()
      .from(posOrdersTable)
      .where(and(eq(posOrdersTable.branchId, activeBranchId), eq(posOrdersTable.date, today)))
      .catch(() => []),
    db
      .select()
      .from(posTablesTable)
      .where(and(eq(posTablesTable.branchId, activeBranchId), isNull(posTablesTable.deletedAt)))
      .catch(() => []),
  ])

  const branchTodayOrders = allOrdersRaw as unknown as PosOrder[]

  // Billed orders sorted oldest-first (by generatedAt)
  const billedOrders = branchTodayOrders
    .filter((o) => o.status === 'billed')
    .sort((a, b) => (a.bill?.generatedAt || '').localeCompare(b.bill?.generatedAt || ''))

  // Paid orders sorted newest-first (by paidAt)
  const paidOrders = branchTodayOrders
    .filter((o) => o.status === 'paid')
    .sort((a, b) => (b.payment?.paidAt || '').localeCompare(a.payment?.paidAt || ''))

  // Open orders (for secondary bill generation input)
  const openOrders = branchTodayOrders.filter((o) => o.status === 'open')

  // Table names and AC status
  const tableMap: Record<string, string> = {}
  const tableAcMap: Record<string, boolean> = {}
  ;(allTables as PosTable[]).forEach((t) => {
    tableMap[t.id] = t.name
    tableAcMap[t.id] = Boolean(t.isAc)
  })

  return (
    <BillingClientPage
      branches={allBranches}
      activeBranchId={activeBranchId}
      billedOrders={billedOrders}
      paidOrders={paidOrders}
      openOrders={openOrders}
      tableMap={tableMap}
      tableAcMap={tableAcMap}
      session={session}
      posDefaultGstPercent={config?.posDefaultGstPercent ?? 0}
      posDefaultParcelPercent={config?.posDefaultParcelPercent ?? 0}
      posDefaultAcPercent={config?.posDefaultAcPercent ?? 0}
      posPricingMode={(config?.posPricingMode as 'percentage' | 'item_price') ?? 'percentage'}
    />
  )
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<{ branch?: string }>
}) {
  return loadBillingPage(undefined, searchParams)
}
