import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'
import { readJSON, DB_FILES } from '@/lib/db'
import { getTodayPosData } from '@/app/actions/pos'
import type { Config } from '@/app/actions/config'
import type { PosOrder, PosTable } from '@/app/actions/posTypes'
import WaiterOrderClientPage from './WaiterOrderClientPage'

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export default async function WaiterOrderPage({
  searchParams,
}: {
  searchParams?: Promise<{ branch?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/management/login')

  // Allowed roles: waiter, manager, owner, admin
  if (!['waiter', 'manager', 'owner', 'admin'].includes(session.role)) {
    redirect('/management')
  }

  const configList = await readJSON<Config>(DB_FILES.CONFIG).catch(() => [])
  const config = configList[0]
  if (!config?.pos) {
    redirect('/management')
  }

  let allBranches = await readJSON<{ id: string; name: string; isActive?: boolean }>(DB_FILES.BRANCHES).catch(() => [])
  allBranches = allBranches.filter(b => b.isActive !== false)

  if (!session.isGlobalAdmin) {
    allBranches = allBranches.filter(b => b.id === session.branchId)
  }

  const resolvedParams = searchParams ? await searchParams : undefined
  const requestedBranch = resolvedParams?.branch
  const activeBranchId = (session.isGlobalAdmin && requestedBranch && allBranches.some(b => b.id === requestedBranch))
    ? requestedBranch
    : (session.isGlobalAdmin ? allBranches[0]?.id : session.branchId) || ''

  if (!activeBranchId) {
    redirect('/management')
  }

  const todayDataResult = await getTodayPosData(activeBranchId)
  if ('error' in todayDataResult) {
    redirect('/management')
  }

  // Check for stale orders
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
    <WaiterOrderClientPage
      branches={allBranches}
      activeBranchId={activeBranchId}
      initialData={todayDataResult}
      staleOrders={staleOrders}
      session={session}
    />
  )
}
