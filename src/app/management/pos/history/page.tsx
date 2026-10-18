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

  let allBranches = await readJSON<{ id: string; name: string; isActive?: boolean }>(DB_FILES.BRANCHES).catch(() => [])
  allBranches = allBranches.filter(b => b.isActive !== false)

  return <PosHistoryClientPage branches={allBranches} session={session} />
}
