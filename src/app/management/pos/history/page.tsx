import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'
import { readJSON, DB_FILES } from '@/lib/db'
import PosHistoryClientPage from './PosHistoryClientPage'

export default async function PosHistoryPage() {
  const session = await getSession()
  if (!session) redirect('/management/login')

  // Accessible to owner and admin only (Req 8.1, Req 7.1)
  if (!['owner', 'admin'].includes(session.role) && !session.isGlobalAdmin) {
    redirect('/management')
  }

  const configList = await readJSON<{ pos?: boolean }>(DB_FILES.CONFIG).catch(() => [])
  const config = configList[0]
  if (!config?.pos) {
    redirect('/management')
  }

  const [allBranches, allTables, allUsers] = await Promise.all([
    readJSON<{ id: string; name: string; isActive?: boolean }>(DB_FILES.BRANCHES).catch(() => []),
    readJSON<{ id: string; name: string }>(DB_FILES.POS_TABLES).catch(() => []),
    readJSON<{ id: string; name: string }>(DB_FILES.USERS).catch(() => []),
  ])

  const activeBranches = allBranches.filter(b => b.isActive !== false)

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
      branches={activeBranches}
      tableMap={tableMap}
      userMap={userMap}
      session={session}
    />
  )
}
