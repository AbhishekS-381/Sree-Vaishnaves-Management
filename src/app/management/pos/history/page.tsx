import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'
import {
  db,
  config as configTable,
  branches as branchesTable,
  posTables as posTablesTable,
  users as usersTable,
} from '@/lib/db'
import { eq, and, isNull } from 'drizzle-orm'
import PosHistoryClientPage from './PosHistoryClientPage'

export default async function PosHistoryPage() {
  const session = await getSession()
  if (!session) redirect('/management/login')

  // Accessible to owner and admin only (Req 8.1, Req 7.1)
  if (!['owner', 'admin'].includes(session.role) && !session.isGlobalAdmin) {
    redirect('/management')
  }

  const configList = await db.select().from(configTable).limit(1).catch(() => [])
  const config = configList[0]
  if (!config?.pos) {
    redirect('/management')
  }

  const [allBranches, allTables, allUsers] = await Promise.all([
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
    db
      .select({ id: posTablesTable.id, name: posTablesTable.name })
      .from(posTablesTable)
      .where(isNull(posTablesTable.deletedAt))
      .catch(() => []),
    db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.isActive, true))
      .catch(() => []),
  ])

  const tableMap: Record<string, string> = {}
  for (const t of allTables) {
    tableMap[t.id] = t.name
  }

  const userMap: Record<string, string> = {}
  for (const u of allUsers) {
    userMap[u.id] = u.name
  }

  return (
    <PosHistoryClientPage
      branches={allBranches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address ?? undefined,
        phone: b.phone ?? undefined,
        gstin: b.gstin ?? undefined,
      }))}
      tableMap={tableMap}
      userMap={userMap}
      session={session}
    />
  )
}
