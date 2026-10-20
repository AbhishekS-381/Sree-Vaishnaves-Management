import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'
import { readJSON, DB_FILES } from '@/lib/db'
import { getKitchenKots } from '@/app/actions/pos'
import type { Config } from '@/app/actions/config'
import type { PosKot, PosOrder, PosTable } from '@/app/actions/posTypes'
import KitchenClientPage from './KitchenClientPage'

import { resolvePosBranchId } from '@/lib/posUtils'

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export async function loadKitchenPage(
  branchParam?: string,
  searchParams?: Promise<{ branch?: string }>
) {
  const session = await getSession()
  if (!session) {
    redirect('/management/login')
    return null as any
  }

  // Allowed roles: kitchen, manager, owner, admin
  if (!['kitchen', 'manager', 'owner', 'admin'].includes(session.role)) {
    redirect('/management')
  }

  const configList = await readJSON<Config>(DB_FILES.CONFIG).catch(() => [])
  const config = configList[0]
  if (!config?.pos) {
    redirect('/management')
  }

  let allBranches = await readJSON<{ id: string; name: string; isActive?: boolean }>(DB_FILES.BRANCHES).catch(() => [])
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

  const activeKotsResult = await getKitchenKots(activeBranchId)
  const initialKots = ('kots' in activeKotsResult && activeKotsResult.kots) ? activeKotsResult.kots : []

  // Load served KOTs for today for the collapsible section
  const today = todayIST()
  const allOrders = await readJSON<PosOrder>(DB_FILES.POS_ORDERS).catch(() => [])
  const todayOrders = allOrders.filter(o => o.branchId === activeBranchId && o.date === today)
  const orderMap = new Map(todayOrders.map(o => [o.id, o]))

  const allTables = await readJSON<PosTable>(DB_FILES.POS_TABLES).catch(() => [])
  const tableMap = new Map(allTables.map(t => [t.id, t.name]))

  const allKots = await readJSON<PosKot>(DB_FILES.POS_KOTS).catch(() => [])
  const orderIds = new Set(todayOrders.map(o => o.id))

  const initialServedKots = allKots
    .filter(k => k.branchId === activeBranchId && orderIds.has(k.orderId) && k.status === 'served')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(k => {
      const order = orderMap.get(k.orderId)
      const tableName = order?.tableId ? tableMap.get(order.tableId) : undefined
      const orderIdentifier = tableName || order?.takeawayNumber || 'Unknown'

      return {
        id: k.id,
        orderId: k.orderId,
        kotNumber: k.kotNumber,
        items: k.items.map(i => ({
          nameSnapshot: i.nameSnapshot,
          quantity: i.quantity,
          note: i.note,
        })),
        status: k.status,
        firedAt: k.firedAt,
        orderIdentifier,
        orderType: order?.orderType,
      }
    })

  return (
    <KitchenClientPage
      branches={allBranches}
      branchId={activeBranchId}
      initialActiveKots={initialKots}
      initialServedKots={initialServedKots}
      session={session}
    />
  )
}

export default async function KitchenPage({
  searchParams,
}: {
  searchParams?: Promise<{ branch?: string }>
}) {
  return loadKitchenPage(undefined, searchParams)
}

