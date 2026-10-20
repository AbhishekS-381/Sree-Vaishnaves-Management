import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'
import { readJSON, DB_FILES } from '@/lib/db'
import { getTodayPosData } from '@/app/actions/pos'
import type { PosOrder, PosTable } from '@/app/actions/posTypes'
import type { Config } from '@/app/actions/config'
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

  const configList = await readJSON<Config>(DB_FILES.CONFIG).catch(() => [])
  const config = configList[0]
  if (!config?.pos) {
    redirect('/management')
  }

  let allBranches = await readJSON<{ id: string; name: string; address?: string; phone?: string; isActive?: boolean }>(DB_FILES.BRANCHES).catch(() => [])
  allBranches = allBranches.filter(b => b.isActive !== false)

  const isGlobalAdmin = Boolean(session.isGlobalAdmin || session.role === 'admin' || session.role === 'owner')

  if (!isGlobalAdmin) {
    allBranches = allBranches.filter(b => b.id === session.branchId)
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
  const allOrders = await readJSON<PosOrder>(DB_FILES.POS_ORDERS).catch(() => [])
  const allTables = await readJSON<PosTable>(DB_FILES.POS_TABLES).catch(() => [])
  const tableMap = new Map(allTables.map(t => [t.id, t.name]))

  const staleOrders = allOrders
    .filter(o => o.branchId === activeBranchId && o.status === 'open' && o.date < today)
    .map(o => ({
      ...o,
      tableName: o.tableId ? tableMap.get(o.tableId) || 'Table' : o.takeawayNumber || 'Takeaway',
    }))

  return (
    <PosClientPage
      branches={allBranches}
      activeBranchId={activeBranchId}
      initialData={initialData}
      staleOrders={staleOrders}
      session={session}
      posDefaultGstPercent={config?.posDefaultGstPercent ?? 0}
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

