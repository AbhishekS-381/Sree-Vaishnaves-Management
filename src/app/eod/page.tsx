import { readJSON, DB_FILES } from '@/lib/db'
import EODClientPage from './EODClientPage'
import { getSession } from '@/app/actions/auth'

export default async function EODPage() {
  const session = await getSession();
  let branches = await readJSON<any>(DB_FILES.BRANCHES)
  const categories = await readJSON<any>(DB_FILES.CATEGORIES).catch(() => [])

  if (!session?.isGlobalAdmin && session?.role !== 'readonly') {
    branches = branches.filter((b: any) => b.id === session?.branchId)
  }
  
  branches = branches.filter((b: any) => b.isActive !== false)

  return (
    <EODClientPage branches={branches} categories={categories} />
  )
}
