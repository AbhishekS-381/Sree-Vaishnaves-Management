import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'
import { readJSON, DB_FILES } from '@/lib/db'
import type { Config } from '@/app/actions/config'
import type { PosOrder, PosTable } from '@/app/actions/posTypes'
import BillingClientPage from './BillingClientPage'

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<{ branch?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/management/login')

  // Allowed roles: billing, manager, owner, admin
  if (!['billing', 'manager', 'owner', 'admin'].includes(session.role)) {
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

  const today = todayIST()
  const allOrders = await readJSON<PosOrder>(DB_FILES.POS_ORDERS).catch(() => [])
  const branchTodayOrders = allOrders.filter(o => o.branchId === activeBranchId && o.date === today)

  // Billed orders sorted oldest-first (by generatedAt)
  const billedOrders = branchTodayOrders
    .filter(o => o.status === 'billed')
    .sort((a, b) => (a.bill?.generatedAt || '').localeCompare(b.bill?.generatedAt || ''))

  // Paid orders sorted newest-first (by paidAt)
  const paidOrders = branchTodayOrders
    .filter(o => o.status === 'paid')
    .sort((a, b) => (b.payment?.paidAt || '').localeCompare(a.payment?.paidAt || ''))

  // Open orders (for secondary bill generation input)
  const openOrders = branchTodayOrders.filter(o => o.status === 'open')

  // Table names
  const allTables = await readJSON<PosTable>(DB_FILES.POS_TABLES).catch(() => [])
  const tableMap: Record<string, string> = {}
  allTables.forEach(t => {
    tableMap[t.id] = t.name
  })

  return (
    <BillingClientPage
      branches={allBranches}
      activeBranchId={activeBranchId}
      billedOrders={billedOrders}
      paidOrders={paidOrders}
      openOrders={openOrders}
      tableMap={tableMap}
      session={session}
      posDefaultGstPercent={config?.posDefaultGstPercent ?? 0}
    />
  )
}
