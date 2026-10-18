import { readJSON, DB_FILES } from '@/lib/db'
import EODClientPage from './EODClientPage'
import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'
import { computePosEodData } from '@/lib/posUtils'
import type { PosOrder, PosEodData } from '@/app/actions/posTypes'
import type { Config } from '@/app/actions/config'

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export default async function EODPage() {
  const session = await getSession()
  if (session?.role === 'readonly') redirect('/management')

  type Branch = { id: string; name: string; isActive?: boolean }
  let branches = await readJSON<Branch>(DB_FILES.BRANCHES)
  const categories = await readJSON<Record<string, unknown>>(DB_FILES.CATEGORIES).catch(() => [])
  const attendance = await readJSON<Record<string, unknown>>(DB_FILES.ATTENDANCE).catch(() => [])

  if (!session?.isGlobalAdmin) {
    branches = branches.filter((b) => b.id === session?.branchId)
  }
  branches = branches.filter((b) => b.isActive !== false)

  const configList = await readJSON<Config>(DB_FILES.CONFIG).catch(() => [])
  const config = configList[0]

  const today = todayIST()
  const defaultBranchId = session?.isGlobalAdmin ? branches[0]?.id : session?.branchId

  let initialPosEodData: PosEodData | null = null
  if (config?.pos && defaultBranchId) {
    const allOrders = await readJSON<PosOrder>(DB_FILES.POS_ORDERS).catch(() => [])
    const todayBranchOrders = allOrders.filter(o => o.branchId === defaultBranchId && o.date === today)
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
