import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'
import {
  db,
  branches as branchesTable,
  config as configTable,
  posOrders as posOrdersTable,
  posTables as posTablesTable,
  posKots as posKotsTable,
} from '@/lib/db'
import { eq, and, isNull, inArray, desc } from 'drizzle-orm'
import { getKitchenKots } from '@/app/actions/pos'
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

  const configList = await db.select().from(configTable).limit(1).catch(() => [])
  const config = configList[0]
  if (!config?.pos) {
    redirect('/management')
  }

  let allBranches = await db
    .select({
      id: branchesTable.id,
      name: branchesTable.name,
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

  const activeKotsResult = await getKitchenKots(activeBranchId)
  const initialKots = ('kots' in activeKotsResult && activeKotsResult.kots) ? activeKotsResult.kots : []

  // Load served KOTs for today for the collapsible section
  const today = todayIST()
  const [todayOrdersRaw, allTables] = await Promise.all([
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

  const todayOrders = todayOrdersRaw as unknown as PosOrder[]
  const orderMap = new Map(todayOrders.map((o) => [o.id, o]))
  const tableMap = new Map((allTables as PosTable[]).map((t) => [t.id, t.name]))
  const orderIds = todayOrders.map((o) => o.id)

  let initialServedKots: any[] = []
  if (orderIds.length > 0) {
    const servedKotsRaw = await db
      .select()
      .from(posKotsTable)
      .where(
        and(
          eq(posKotsTable.branchId, activeBranchId),
          inArray(posKotsTable.orderId, orderIds),
          eq(posKotsTable.status, 'served')
        )
      )
      .orderBy(desc(posKotsTable.updatedAt))
      .catch(() => [])

    initialServedKots = (servedKotsRaw as any[]).map((k) => {
      const order = orderMap.get(k.orderId)
      const tableName = order?.tableId ? tableMap.get(order.tableId) : undefined
      const orderIdentifier = tableName || order?.takeawayNumber || 'Unknown'

      return {
        id: k.id,
        orderId: k.orderId,
        kotNumber: k.kotNumber,
        items: ((k.items as any[]) || []).map((i: any) => ({
          nameSnapshot: i.nameSnapshot,
          quantity: i.quantity,
          note: i.note,
          isParcel: Boolean(i.isParcel),
        })),
        status: k.status,
        firedAt: k.firedAt instanceof Date ? k.firedAt.toISOString() : String(k.firedAt || ''),
        orderIdentifier,
        orderType: order?.orderType,
      }
    })
  }

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
