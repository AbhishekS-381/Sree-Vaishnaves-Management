import {
  db,
  branches as branchesTable,
  categories as categoriesTable,
  attendance as attendanceTable,
  config as configTable,
  posOrders as posOrdersTable,
} from '@/lib/db'
import { eq, and, isNull } from 'drizzle-orm'
import EODClientPage from './EODClientPage'
import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'
import { computePosEodData } from '@/lib/posUtils'
import type { PosOrder, PosEodData } from '@/app/actions/posTypes'

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export default async function EODPage() {
  const session = await getSession()
  if (session?.role === 'readonly') redirect('/management')

  let branchesQuery = db
    .select({
      id: branchesTable.id,
      name: branchesTable.name,
      isActive: branchesTable.isActive,
    })
    .from(branchesTable)
    .where(and(eq(branchesTable.isActive, true), isNull(branchesTable.deletedAt)))

  if (!session?.isGlobalAdmin && session?.branchId) {
    branchesQuery = db
      .select({
        id: branchesTable.id,
        name: branchesTable.name,
        isActive: branchesTable.isActive,
      })
      .from(branchesTable)
      .where(
        and(
          eq(branchesTable.id, session.branchId),
          eq(branchesTable.isActive, true),
          isNull(branchesTable.deletedAt)
        )
      )
  }

  const [branches, categories, attendance, configList] = await Promise.all([
    branchesQuery.catch(() => []),
    db.select().from(categoriesTable).catch(() => []),
    db.select().from(attendanceTable).catch(() => []),
    db.select().from(configTable).limit(1).catch(() => []),
  ])

  const config = configList[0]

  const today = todayIST()
  const defaultBranchId = session?.isGlobalAdmin ? branches[0]?.id : session?.branchId

  let initialPosEodData: PosEodData | null = null
  if (config?.pos && defaultBranchId) {
    const todayBranchOrders = (await db
      .select()
      .from(posOrdersTable)
      .where(and(eq(posOrdersTable.branchId, defaultBranchId), eq(posOrdersTable.date, today)))
      .catch(() => [])) as unknown as PosOrder[]

    initialPosEodData = computePosEodData(todayBranchOrders)
  }

  return (
    <EODClientPage
      branches={branches}
      categories={categories}
      attendance={attendance}
      posEodData={initialPosEodData}
      posEnabled={!!config?.pos}
    />
  )
}
